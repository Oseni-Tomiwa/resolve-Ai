import { ForbiddenException, Inject, Injectable, NotFoundException, Optional } from '@nestjs/common';
import type { PrismaClient } from '@resolveai/database';
import type { OrganizationDto } from './dto';
// Nest dependency injection needs this constructor at runtime.
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { AuditLogService } from '../audit-log/audit-log.service';
@Injectable()
export class OrganizationsService {
  constructor(@Inject('PRISMA') private readonly db: PrismaClient, @Optional() private readonly audit?: AuditLogService) {}
  async create(userId: string, dto: OrganizationDto) { return this.db.$transaction(async (tx) => { const organization = await tx.organization.create({ data: { name: dto.name.trim(), slug: dto.slug } }); await tx.organizationMember.create({ data: { userId, organizationId: organization.id, role: 'OWNER' } }); const workspace = await tx.workspace.create({ data: { organizationId: organization.id, name: 'General', slug: 'general' } }); await tx.workspaceMember.create({ data: { workspaceId: workspace.id, userId, role: 'ADMIN' } }); return { ...organization, workspaces: [workspace] }; }); }
  async list(userId: string) { return this.db.organization.findMany({ where: { members: { some: { userId } } }, orderBy: { createdAt: 'asc' }, include: { members: { where: { userId }, select: { role: true } } } }); }
  async get(userId: string, id: string) { const value = await this.db.organization.findFirst({ where: { id, members: { some: { userId } } }, include: { workspaces: true } }); if (!value) throw new NotFoundException('Organization not found'); return value; }
  async update(userId: string, id: string, dto: OrganizationDto) { const member = await this.db.organizationMember.findUnique({ where: { userId_organizationId: { userId, organizationId: id } } }); if (!member || !['OWNER', 'ADMIN'].includes(member.role)) throw new ForbiddenException('Insufficient organization permissions'); const updated = await this.db.organization.update({ where: { id }, data: dto }); await this.audit?.record({ organizationId: id, actorUserId: userId, action: 'organization.settings_changed', targetType: 'organization', targetId: id }); return updated; }
  async remove(userId: string, id: string) { const member = await this.db.organizationMember.findUnique({ where: { userId_organizationId: { userId, organizationId: id } } }); if (!member || member.role !== 'OWNER') throw new ForbiddenException('Only the owner can delete an organization'); await this.db.organization.delete({ where: { id } }); }
}
