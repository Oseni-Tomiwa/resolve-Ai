import { BadRequestException, ConflictException, Inject, Injectable } from '@nestjs/common';
import type { PrismaClient } from '@resolveai/database';
import type { OnboardingDto } from './dto';

const slugify = (value: string): string => value.trim().toLowerCase().replace(/[^a-z0-9\s-]/g, '').replace(/[\s-]+/g, '-').replace(/^-+|-+$/g, '');

@Injectable()
export class OnboardingService {
  constructor(@Inject('PRISMA') private readonly db: PrismaClient) {}

  async status(userId: string) {
    const memberships = await this.db.organizationMember.findMany({ where: { userId }, include: { organization: { include: { workspaces: { where: { members: { some: { userId } } }, orderBy: { createdAt: 'asc' } } } } }, orderBy: { createdAt: 'desc' } });
    const current = memberships[0];
    return { required: memberships.length === 0, organizations: memberships.map(({ organization }) => organization), currentOrganization: current?.organization ?? null, currentWorkspace: current?.organization.workspaces[0] ?? null };
  }

  async create(userId: string, dto: OnboardingDto) {
    const organizationSlug = slugify(dto.organizationSlug || dto.organizationName);
    const workspaceSlug = slugify(dto.workspaceSlug || dto.workspaceName);
    if (!organizationSlug || !workspaceSlug) throw new BadRequestException('Organization and workspace slugs must contain letters or numbers');
    try {
      return await this.db.$transaction(async (tx) => {
        const existingMembership = await tx.organizationMember.findFirst({ where: { userId } });
        if (existingMembership) throw new ConflictException('Onboarding is already complete');
        const organization = await tx.organization.create({ data: { name: dto.organizationName.trim(), slug: organizationSlug, industry: dto.industry, teamSize: dto.teamSize } });
        await tx.organizationMember.create({ data: { userId, organizationId: organization.id, role: 'OWNER' } });
        const workspace = await tx.workspace.create({ data: { organizationId: organization.id, name: dto.workspaceName.trim(), slug: workspaceSlug } });
        await tx.workspaceMember.create({ data: { workspaceId: workspace.id, userId, role: 'ADMIN' } });
        return { organization, workspace };
      });
    } catch (error) {
      if (error instanceof ConflictException) throw error;
      if (typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2002') throw new ConflictException('That organization or workspace slug is already in use');
      throw error;
    }
  }
}
