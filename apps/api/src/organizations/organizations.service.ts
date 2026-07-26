import { ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaClient } from '@resolveai/database';
import { OrganizationDto } from './dto';
@Injectable()
export class OrganizationsService {
  constructor(@Inject('PRISMA') private readonly db: PrismaClient) {}
  async create(userId: string, dto: OrganizationDto) { return this.db.$transaction(async (tx) => { const organization = await tx.organization.create({ data: { name: dto.name.trim(), slug: dto.slug } }); await tx.organizationMember.create({ data: { userId, organizationId: organization.id, role: 'OWNER' } }); const workspace = await tx.workspace.create({ data: { organizationId: organization.id, name: 'General', slug: 'general' } }); await tx.workspaceMember.create({ data: { workspaceId: workspace.id, userId, role: 'ADMIN' } }); return { ...organization, workspaces: [workspace] }; }); }
  async list(userId: string) { return this.db.organization.findMany({ where: { members: { some: { userId } } }, orderBy: { createdAt: 'asc' } }); }
  async get(userId: string, id: string) { const value = await this.db.organization.findFirst({ where: { id, members: { some: { userId } } }, include: { workspaces: true } }); if (!value) throw new NotFoundException('Organization not found'); return value; }
  async update(userId: string, id: string, dto: OrganizationDto) { const member = await this.db.organizationMember.findUnique({ where: { userId_organizationId: { userId, organizationId: id } } }); if (!member || !['OWNER', 'ADMIN'].includes(member.role)) throw new ForbiddenException('Insufficient organization permissions'); return this.db.organization.update({ where: { id }, data: dto }); }
  async remove(userId: string, id: string) { const member = await this.db.organizationMember.findUnique({ where: { userId_organizationId: { userId, organizationId: id } } }); if (!member || member.role !== 'OWNER') throw new ForbiddenException('Only the owner can delete an organization'); await this.db.organization.delete({ where: { id } }); }
}
