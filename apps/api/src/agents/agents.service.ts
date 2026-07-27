import { ConflictException, ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma, PrismaClient } from '@resolveai/database';
import { defaultAgent, defaultAgentMaxOutputTokens, defaultAgentModel, defaultAgentTemperature } from './agent.config';
import type { AgentListQueryDto, CreateAgentDto, UpdateAgentDto } from './dto';

const canManage = (organizationRole: string, workspaceRole: string): boolean => ['OWNER', 'ADMIN'].includes(organizationRole) || workspaceRole === 'ADMIN';
const slugify = (value: string): string => value.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 70) || 'agent';
const trimNullable = (value: string | null | undefined): string | null | undefined => value === undefined ? undefined : value?.trim() || null;

@Injectable()
export class AgentsService {
  constructor(@Inject('PRISMA') private readonly db: PrismaClient) {}

  private async access(userId: string, workspaceId: string) {
    const workspace = await this.db.workspace.findUnique({ where: { id: workspaceId }, select: { organizationId: true } });
    if (!workspace) throw new NotFoundException('Workspace not found');
    const [organization, member] = await Promise.all([
      this.db.organizationMember.findUnique({ where: { userId_organizationId: { userId, organizationId: workspace.organizationId } } }),
      this.db.workspaceMember.findUnique({ where: { workspaceId_userId: { workspaceId, userId } } }),
    ]);
    if (!organization || (!member && !['OWNER', 'ADMIN'].includes(organization.role))) throw new ForbiddenException('Workspace membership required');
    return { organizationRole: organization.role, workspaceRole: member?.role ?? '' };
  }

  private async requireManager(userId: string, workspaceId: string) {
    const access = await this.access(userId, workspaceId);
    if (!canManage(access.organizationRole, access.workspaceRole)) throw new ForbiddenException('Insufficient workspace permissions');
    return access;
  }

  private view(agent: { id: string; workspaceId: string; name: string; description: string | null; instructions: string; greeting: string | null; fallbackMessage: string | null; model: string; temperature: number; maxOutputTokens: number; status: string; isDefault: boolean; createdAt: Date; updatedAt: Date }, includeConfiguration: boolean) {
    return { id: agent.id, workspaceId: agent.workspaceId, name: agent.name, description: agent.description, greeting: agent.greeting, model: agent.model, status: agent.status, isDefault: agent.isDefault, createdAt: agent.createdAt, updatedAt: agent.updatedAt, ...(includeConfiguration ? { instructions: agent.instructions, fallbackMessage: agent.fallbackMessage, temperature: agent.temperature, maxOutputTokens: agent.maxOutputTokens } : {}) };
  }

  async ensureDefault(workspaceId: string, createdByUserId: string) {
    const existing = await this.db.aIAgent.findFirst({ where: { workspaceId, isDefault: true, deletedAt: null, status: 'ACTIVE' } });
    if (existing) return existing;
    try {
      return await this.db.aIAgent.create({ data: { workspaceId, createdByUserId, ...defaultAgent, model: defaultAgentModel, temperature: defaultAgentTemperature, maxOutputTokens: defaultAgentMaxOutputTokens, status: 'ACTIVE', isDefault: true } });
    } catch (error) {
      if ((error as { code?: string }).code !== 'P2002') throw error;
      const created = await this.db.aIAgent.findFirst({ where: { workspaceId, isDefault: true, deletedAt: null, status: 'ACTIVE' } });
      if (!created) throw error;
      return created;
    }
  }

  async requireActiveForConversation(userId: string, workspaceId: string, agentId: string) {
    await this.access(userId, workspaceId);
    const agent = await this.db.aIAgent.findFirst({ where: { id: agentId, workspaceId, deletedAt: null, status: 'ACTIVE' } });
    if (!agent) throw new NotFoundException('Active agent not found');
    return agent;
  }

  async requireActiveForGeneration(workspaceId: string, agentId: string) {
    const agent = await this.db.aIAgent.findFirst({ where: { id: agentId, workspaceId, deletedAt: null, status: 'ACTIVE' } });
    if (!agent) throw new ConflictException('This agent is no longer active');
    return agent;
  }

  async create(userId: string, workspaceId: string, dto: CreateAgentDto) {
    await this.requireManager(userId, workspaceId);
    const existingCount = await this.db.aIAgent.count({ where: { workspaceId, deletedAt: null } });
    const shouldBeDefault = dto.isDefault === true || existingCount === 0;
    const data = { workspaceId, createdByUserId: userId, name: dto.name.trim(), slug: slugify(dto.name), description: trimNullable(dto.description) ?? null, instructions: dto.instructions.trim(), greeting: trimNullable(dto.greeting) ?? null, fallbackMessage: trimNullable(dto.fallbackMessage) ?? null, model: dto.model ?? defaultAgentModel, temperature: dto.temperature ?? defaultAgentTemperature, maxOutputTokens: dto.maxOutputTokens ?? defaultAgentMaxOutputTokens, status: shouldBeDefault ? 'ACTIVE' as const : dto.status ?? 'DRAFT' as const, isDefault: shouldBeDefault };
    try {
      const agent = await this.db.$transaction(async (tx) => {
        if (shouldBeDefault) await tx.aIAgent.updateMany({ where: { workspaceId, isDefault: true, deletedAt: null }, data: { isDefault: false } });
        return tx.aIAgent.create({ data });
      });
      return this.view(agent, true);
    } catch (error) {
      if ((error as { code?: string }).code === 'P2002') throw new ConflictException('An agent with this name already exists in the workspace');
      throw error;
    }
  }

  async list(userId: string, workspaceId: string, query: AgentListQueryDto) {
    const access = await this.access(userId, workspaceId);
    const agentCount = await this.db.aIAgent.count({ where: { workspaceId, deletedAt: null } });
    if (agentCount === 0) await this.ensureDefault(workspaceId, userId);
    const includeConfiguration = canManage(access.organizationRole, access.workspaceRole);
    const where: Prisma.AIAgentWhereInput = { workspaceId, deletedAt: null, ...(includeConfiguration ? {} : { status: 'ACTIVE' }), ...(query.search?.trim() ? { name: { contains: query.search.trim(), mode: 'insensitive' } } : {}) };
    const [items, total] = await this.db.$transaction([this.db.aIAgent.findMany({ where, orderBy: [{ isDefault: 'desc' }, { updatedAt: 'desc' }], skip: (query.page - 1) * query.pageSize, take: query.pageSize }), this.db.aIAgent.count({ where })]);
    return { items: items.map((agent) => this.view(agent, includeConfiguration)), page: query.page, pageSize: query.pageSize, total, hasMore: query.page * query.pageSize < total };
  }

  async detail(userId: string, workspaceId: string, agentId: string) {
    const access = await this.access(userId, workspaceId);
    const includeConfiguration = canManage(access.organizationRole, access.workspaceRole);
    const agent = await this.db.aIAgent.findFirst({ where: { id: agentId, workspaceId, deletedAt: null, ...(includeConfiguration ? {} : { status: 'ACTIVE' }) } });
    if (!agent) throw new NotFoundException('Agent not found');
    return this.view(agent, includeConfiguration);
  }

  async update(userId: string, workspaceId: string, agentId: string, dto: UpdateAgentDto) {
    await this.requireManager(userId, workspaceId);
    const current = await this.db.aIAgent.findFirst({ where: { id: agentId, workspaceId, deletedAt: null } });
    if (!current) throw new NotFoundException('Agent not found');
    if (current.isDefault && dto.status && dto.status !== 'ACTIVE') throw new ConflictException('Choose another default agent before disabling this agent');
    if (dto.isDefault === true && (dto.status ?? current.status) !== 'ACTIVE') throw new ConflictException('Only active agents can be the workspace default');
    const data = { ...(dto.name === undefined ? {} : { name: dto.name.trim(), slug: slugify(dto.name) }), ...(dto.description === undefined ? {} : { description: trimNullable(dto.description) }), ...(dto.instructions === undefined ? {} : { instructions: dto.instructions.trim() }), ...(dto.greeting === undefined ? {} : { greeting: trimNullable(dto.greeting) }), ...(dto.fallbackMessage === undefined ? {} : { fallbackMessage: trimNullable(dto.fallbackMessage) }), ...(dto.model === undefined ? {} : { model: dto.model }), ...(dto.temperature === undefined ? {} : { temperature: dto.temperature }), ...(dto.maxOutputTokens === undefined ? {} : { maxOutputTokens: dto.maxOutputTokens }), ...(dto.status === undefined ? {} : { status: dto.status }), ...(dto.isDefault === undefined ? {} : { isDefault: dto.isDefault }) };
    try {
      const agent = await this.db.$transaction(async (tx) => {
        if (dto.isDefault === true) await tx.aIAgent.updateMany({ where: { workspaceId, isDefault: true, deletedAt: null, id: { not: agentId } }, data: { isDefault: false } });
        return tx.aIAgent.update({ where: { id: agentId }, data });
      });
      return this.view(agent, true);
    } catch (error) {
      if ((error as { code?: string }).code === 'P2002') throw new ConflictException('An agent with this name already exists in the workspace');
      throw error;
    }
  }

  async setDefault(userId: string, workspaceId: string, agentId: string) {
    await this.requireManager(userId, workspaceId);
    const agent = await this.db.aIAgent.findFirst({ where: { id: agentId, workspaceId, deletedAt: null, status: 'ACTIVE' } });
    if (!agent) throw new NotFoundException('Active agent not found');
    const selected = await this.db.$transaction(async (tx) => { await tx.aIAgent.updateMany({ where: { workspaceId, isDefault: true, deletedAt: null }, data: { isDefault: false } }); return tx.aIAgent.update({ where: { id: agentId }, data: { isDefault: true } }); });
    return this.view(selected, true);
  }

  async remove(userId: string, workspaceId: string, agentId: string): Promise<void> {
    await this.requireManager(userId, workspaceId);
    const agent = await this.db.aIAgent.findFirst({ where: { id: agentId, workspaceId, deletedAt: null } });
    if (!agent) throw new NotFoundException('Agent not found');
    if (agent.isDefault) throw new ConflictException('Choose another default agent before deleting this agent');
    await this.db.aIAgent.update({ where: { id: agentId }, data: { deletedAt: new Date(), status: 'DISABLED' } });
  }
}
