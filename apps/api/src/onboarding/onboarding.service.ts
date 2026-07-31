import { BadRequestException, ConflictException, ForbiddenException, Inject, Injectable } from '@nestjs/common';
import type { PrismaClient } from '@resolveai/database';
import type { OnboardingDto, OnboardingProgressDto } from './dto';

const slugify = (value: string): string => value.trim().toLowerCase().replace(/[^a-z0-9\s-]/g, '').replace(/[\s-]+/g, '-').replace(/^-+|-+$/g, '');
export const onboardingSteps = ['WELCOME', 'ORGANIZATION', 'WORKSPACE', 'AGENT', 'KNOWLEDGE', 'TEST', 'WIDGET', 'INSTALLATION', 'COMPLETE'] as const;

@Injectable()
export class OnboardingService {
  constructor(@Inject('PRISMA') private readonly db: PrismaClient) {}

  async status(userId: string) {
    const memberships = await this.db.organizationMember.findMany({ where: { userId }, include: { organization: { include: { workspaces: { where: { members: { some: { userId } } }, orderBy: { createdAt: 'asc' } } } } }, orderBy: { createdAt: 'desc' } });
    const current = memberships[0];
    const workspace = current?.organization.workspaces[0] ?? null;
    const progress = this.db.onboardingProgress ? await this.db.onboardingProgress.upsert({ where: { userId }, create: { userId, ...(workspace ? { workspaceId: workspace.id } : {}) }, update: workspace ? { workspaceId: workspace.id } : {} }) : { completedSteps: [], skippedSteps: [], currentStep: 'WELCOME', completedAt: null };
    const [agent, document, widget] = workspace && this.db.aIAgent && this.db.knowledgeDocument && this.db.widgetConfiguration ? await Promise.all([
      this.db.aIAgent.findFirst({ where: { workspaceId: workspace.id, deletedAt: null } }),
      this.db.knowledgeDocument.findFirst({ where: { workspaceId: workspace.id, status: 'READY', deletedAt: null } }),
      this.db.widgetConfiguration.findFirst({ where: { workspaceId: workspace.id, enabled: true } }),
    ]) : [null, null, null];
    const completed = new Set(progress.completedSteps);
    if (memberships.length) { completed.add('WELCOME'); completed.add('ORGANIZATION'); completed.add('WORKSPACE'); }
    if (agent) completed.add('AGENT'); if (document) completed.add('KNOWLEDGE'); if (widget) completed.add('WIDGET');
    const teammate = memberships.length > 0 && !memberships.some((membership) => membership.role === 'OWNER');
    const required = !teammate && !progress.completedAt && (!workspace || !['AGENT', 'KNOWLEDGE', 'TEST', 'WIDGET', 'INSTALLATION'].every((step) => completed.has(step)));
    return { required, mode: teammate ? 'TEAMMATE' : 'OWNER', organizations: memberships.map(({ organization }) => organization), currentOrganization: current?.organization ?? null, currentWorkspace: workspace, progress: { ...progress, completedSteps: [...completed], remainingSteps: onboardingSteps.filter((step) => !completed.has(step) && step !== 'COMPLETE') } };
  }

  async create(userId: string, dto: OnboardingDto) {
    const organizationSlug = slugify(dto.organizationSlug || dto.organizationName);
    const workspaceSlug = slugify(dto.workspaceSlug || dto.workspaceName);
    if (!organizationSlug || !workspaceSlug) throw new BadRequestException('Organization and workspace slugs must contain letters or numbers');
    try {
      return await this.db.$transaction(async (tx) => {
        const existingMembership = await tx.organizationMember.findFirst({ where: { userId, role: 'OWNER' }, include: { organization: { include: { workspaces: { orderBy: { createdAt: 'asc' } } } } } });
        if (existingMembership) {
          const workspace = existingMembership.organization.workspaces[0];
          if (!workspace) throw new ConflictException('Your organization does not have a workspace yet');
          if (tx.onboardingProgress) await tx.onboardingProgress.upsert({ where: { userId }, create: { userId, workspaceId: workspace.id, currentStep: 'AGENT', completedSteps: ['WELCOME', 'ORGANIZATION', 'WORKSPACE'] }, update: { workspaceId: workspace.id, completedAt: null } });
          return { organization: existingMembership.organization, workspace };
        }
        const organization = await tx.organization.create({ data: { name: dto.organizationName.trim(), slug: organizationSlug, industry: dto.industry, teamSize: dto.teamSize } });
        await tx.organizationMember.create({ data: { userId, organizationId: organization.id, role: 'OWNER' } });
        const workspace = await tx.workspace.create({ data: { organizationId: organization.id, name: dto.workspaceName.trim(), slug: workspaceSlug } });
        await tx.workspaceMember.create({ data: { workspaceId: workspace.id, userId, role: 'ADMIN' } });
        if (tx.onboardingProgress) await tx.onboardingProgress.upsert({ where: { userId }, create: { userId, workspaceId: workspace.id, currentStep: 'AGENT', completedSteps: ['WELCOME', 'ORGANIZATION', 'WORKSPACE'] }, update: { workspaceId: workspace.id, currentStep: 'AGENT', completedSteps: ['WELCOME', 'ORGANIZATION', 'WORKSPACE'], completedAt: null } });
        return { organization, workspace };
      });
    } catch (error) {
      if (error instanceof ConflictException) throw error;
      if (typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2002') throw new ConflictException('That organization or workspace slug is already in use');
      throw error;
    }
  }

  async updateProgress(userId: string, dto: OnboardingProgressDto) {
    const membership = dto.workspaceId ? await this.db.workspaceMember.findUnique({ where: { workspaceId_userId: { workspaceId: dto.workspaceId, userId } } }) : null;
    if (dto.workspaceId && !membership) throw new ForbiddenException('You do not have access to this workspace');
    const progress = await this.db.onboardingProgress.findUnique({ where: { userId } });
    const completed = new Set(progress?.completedSteps ?? []); const skipped = new Set(progress?.skippedSteps ?? []);
    if (dto.completedStep) completed.add(dto.completedStep); if (dto.skippedStep) skipped.add(dto.skippedStep);
    return this.db.onboardingProgress.upsert({ where: { userId }, create: { userId, workspaceId: dto.workspaceId, currentStep: dto.currentStep ?? 'WELCOME', completedSteps: [...completed], skippedSteps: [...skipped] }, update: { ...(dto.workspaceId ? { workspaceId: dto.workspaceId } : {}), ...(dto.currentStep ? { currentStep: dto.currentStep } : {}), completedSteps: [...completed], skippedSteps: [...skipped] } });
  }

  async complete(userId: string) {
    const state = await this.status(userId);
    if (state.required) throw new BadRequestException('Complete the required onboarding steps first');
    return this.db.onboardingProgress.update({ where: { userId }, data: { currentStep: 'COMPLETE', completedAt: new Date(), completedSteps: [...new Set([...state.progress.completedSteps, 'COMPLETE'])] } });
  }
}
