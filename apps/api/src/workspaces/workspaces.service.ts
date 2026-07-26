import { ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import type { PrismaClient } from '@resolveai/database';
import type { WorkspaceDto } from './dto';
@Injectable()
export class WorkspacesService {
  constructor(@Inject('PRISMA') private readonly db: PrismaClient) {}
  private async orgRole(userId: string, organizationId: string) { return this.db.organizationMember.findUnique({ where: { userId_organizationId: { userId, organizationId } } }); }
  async create(userId: string, organizationId: string, dto: WorkspaceDto) { const member = await this.orgRole(userId, organizationId); if (!member || member.role === 'MEMBER') throw new ForbiddenException('Insufficient organization permissions'); return this.db.$transaction(async (tx) => { const workspace = await tx.workspace.create({ data: { organizationId, name: dto.name.trim(), slug: dto.slug } }); await tx.workspaceMember.create({ data: { workspaceId: workspace.id, userId, role: 'ADMIN' } }); return workspace; }); }
  async list(userId: string, organizationId: string) { const member = await this.orgRole(userId, organizationId); if (!member) throw new ForbiddenException('Organization membership required'); return this.db.workspace.findMany({ where: { organizationId, members: { some: { userId } } }, include: { members: { where: { userId }, select: { role: true } } } }); }
  async get(userId: string, id: string) { const value = await this.db.workspace.findFirst({ where: { id, members: { some: { userId } } } }); if (!value) throw new NotFoundException('Workspace not found'); return value; }
}
