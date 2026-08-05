import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { ConflictException, ForbiddenException, Inject, Injectable, NotFoundException, Optional } from '@nestjs/common';
import type { PrismaClient } from '@resolveai/database';
// Nest dependency injection needs this constructor at runtime.
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { EmailService } from './email.service';
// Nest dependency injection needs this constructor at runtime.
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { WebhookEventsService } from '../webhooks/webhook-events.service';
import type { CreateInvitationDto, UpdateMemberRoleDto } from './dto';
// Nest dependency injection needs this constructor at runtime.
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { AuditLogService } from '../audit-log/audit-log.service';

const normalizeEmail = (email: string): string => email.trim().toLowerCase();
const hashToken = (token: string): string => createHash('sha256').update(token).digest('hex');
const sameHash = (left: string, right: string): boolean => {
  const a = Buffer.from(left); const b = Buffer.from(right);
  return a.length === b.length && timingSafeEqual(a, b);
};
const canManage = (organizationRole: string | undefined, workspaceRole: string | undefined): boolean => organizationRole === 'OWNER' || organizationRole === 'ADMIN' || workspaceRole === 'ADMIN';

type Access = { organizationId: string; organizationRole: string; workspaceRole: string };

@Injectable()
export class WorkspaceAccessService {
  constructor(@Inject('PRISMA') private readonly db: PrismaClient, private readonly email: EmailService, @Optional() private readonly audit?: AuditLogService, @Optional() private readonly events?: WebhookEventsService) {}

  async getAccess(userId: string, workspaceId: string): Promise<Access> {
    const workspace = await this.db.workspace.findFirst({ where: { id: workspaceId }, select: { organizationId: true } });
    if (!workspace) throw new NotFoundException('Workspace not found');
    const [organizationMember, workspaceMember] = await Promise.all([
      this.db.organizationMember.findUnique({ where: { userId_organizationId: { userId, organizationId: workspace.organizationId } } }),
      this.db.workspaceMember.findUnique({ where: { workspaceId_userId: { workspaceId, userId } } }),
    ]);
    if (!organizationMember || (!workspaceMember && !['OWNER', 'ADMIN'].includes(organizationMember.role))) throw new ForbiddenException('Workspace membership required');
    if (workspaceMember?.status === 'SUSPENDED') throw new ForbiddenException('Workspace membership is suspended');
    return { organizationId: workspace.organizationId, organizationRole: organizationMember.role, workspaceRole: workspaceMember?.role ?? '' };
  }
  async assertMember(userId: string, workspaceId: string): Promise<void> { await this.getAccess(userId, workspaceId); }

  private async requireManager(userId: string, workspaceId: string): Promise<Access> {
    const access = await this.getAccess(userId, workspaceId);
    if (!canManage(access.organizationRole, access.workspaceRole)) throw new ForbiddenException('Insufficient workspace permissions');
    return access;
  }

  async createInvitation(userId: string, workspaceId: string, dto: CreateInvitationDto) {
    const access = await this.requireManager(userId, workspaceId);
    if (access.workspaceRole === 'ADMIN' && access.organizationRole === 'MEMBER' && dto.role === 'ADMIN') throw new ForbiddenException('Workspace admins may only assign AGENT or VIEWER');
    const email = normalizeEmail(dto.email);
    const existingMember = await this.db.user.findUnique({ where: { email }, select: { id: true } });
    if (existingMember && await this.db.workspaceMember.findUnique({ where: { workspaceId_userId: { workspaceId, userId: existingMember.id } } })) throw new ConflictException('This user is already a workspace member');
    const active = await this.db.workspaceInvitation.findFirst({ where: { workspaceId, email, acceptedAt: null, revokedAt: null, expiresAt: { gt: new Date() } } });
    if (active) throw new ConflictException('An active invitation already exists for this email');
    const token = randomBytes(32).toString('base64url');
    const expiresAt = new Date(Date.now() + 72 * 60 * 60 * 1000);
    const invitation = await this.db.workspaceInvitation.create({ data: { workspaceId, organizationId: access.organizationId, invitedByUserId: userId, email, role: dto.role, tokenHash: hashToken(token), expiresAt }, include: { workspace: { select: { name: true } }, organization: { select: { name: true } }, invitedBy: { select: { firstName: true, lastName: true } } } });
    const invitationUrl = `${process.env.WEB_URL ?? 'http://localhost:3000'}/invite/${token}`;
    await this.email.sendInvitation({ invitationUrl, email, role: invitation.role, expiresAt, workspaceName: invitation.workspace.name, organizationName: invitation.organization.name, inviterName: `${invitation.invitedBy.firstName} ${invitation.invitedBy.lastName}` });
    await this.audit?.record({ organizationId: access.organizationId, workspaceId, actorUserId: userId, action: 'member.invited', targetType: 'workspace_invitation', targetId: invitation.id, metadata: { role: invitation.role }, });
    void this.events?.publish(workspaceId, 'member.invited', { invitationId: invitation.id, invitedByUserId: userId, role: invitation.role });
    return { ...invitation, localInvitationUrl: process.env.NODE_ENV === 'production' ? undefined : invitationUrl };
  }

  async listInvitations(userId: string, workspaceId: string) {
    await this.getAccess(userId, workspaceId);
    return this.db.workspaceInvitation.findMany({ where: { workspaceId }, orderBy: { createdAt: 'desc' }, include: { invitedBy: { select: { firstName: true, lastName: true, email: true } } } });
  }

  async resendInvitation(userId: string, invitationId: string) {
    const invitation = await this.db.workspaceInvitation.findUnique({ where: { id: invitationId }, include: { workspace: { select: { name: true } }, organization: { select: { name: true } }, invitedBy: { select: { firstName: true, lastName: true } } } });
    if (!invitation) throw new NotFoundException('Invitation not found');
    const access = await this.requireManager(userId, invitation.workspaceId);
    if (invitation.acceptedAt || invitation.revokedAt) throw new ConflictException('This invitation is no longer active');
    const token = randomBytes(32).toString('base64url');
    const expiresAt = new Date(Date.now() + 72 * 60 * 60 * 1000);
    const updated = await this.db.workspaceInvitation.update({ where: { id: invitationId }, data: { tokenHash: hashToken(token), expiresAt, organizationId: access.organizationId }, include: { invitedBy: { select: { firstName: true, lastName: true } } } });
    const invitationUrl = `${process.env.WEB_URL ?? 'http://localhost:3000'}/invite/${token}`;
    await this.email.sendInvitation({ invitationUrl, email: updated.email, role: updated.role, expiresAt, workspaceName: invitation.workspace.name, organizationName: invitation.organization.name, inviterName: `${updated.invitedBy.firstName} ${updated.invitedBy.lastName}` });
    await this.audit?.record({ organizationId: access.organizationId, workspaceId: invitation.workspaceId, actorUserId: userId, action: 'member.invitation_resent', targetType: 'workspace_invitation', targetId: invitation.id });
    return { ...updated, localInvitationUrl: process.env.NODE_ENV === 'production' ? undefined : invitationUrl };
  }

  async revokeInvitation(userId: string, invitationId: string): Promise<void> { const invitation = await this.db.workspaceInvitation.findUnique({ where: { id: invitationId } }); if (!invitation) throw new NotFoundException('Invitation not found'); const access = await this.requireManager(userId, invitation.workspaceId); await this.db.workspaceInvitation.update({ where: { id: invitationId }, data: { revokedAt: new Date() } }); await this.audit?.record({ organizationId: access.organizationId, workspaceId: invitation.workspaceId, actorUserId: userId, action: 'member.invitation_revoked', targetType: 'workspace_invitation', targetId: invitationId }); }

  async validateInvitation(token: string) {
    const invitation = await this.db.workspaceInvitation.findFirst({ where: { tokenHash: hashToken(token) }, include: { workspace: { select: { id: true, name: true } }, organization: { select: { id: true, name: true } }, invitedBy: { select: { firstName: true, lastName: true } } } });
    if (!invitation || invitation.revokedAt || invitation.acceptedAt || invitation.expiresAt <= new Date()) throw new NotFoundException('Invitation is invalid or expired');
    return { id: invitation.id, email: invitation.email, role: invitation.role, expiresAt: invitation.expiresAt, workspace: invitation.workspace, organization: invitation.organization, inviterName: `${invitation.invitedBy.firstName} ${invitation.invitedBy.lastName}` };
  }

  async acceptInvitation(userId: string, token: string) {
    const invitation = await this.db.workspaceInvitation.findFirst({ where: { tokenHash: hashToken(token) } });
    if (!invitation || invitation.revokedAt || invitation.acceptedAt || invitation.expiresAt <= new Date()) throw new NotFoundException('Invitation is invalid or expired');
    const user = await this.db.user.findUnique({ where: { id: userId }, select: { email: true } });
    if (!user || !sameHash(normalizeEmail(user.email), invitation.email)) throw new ForbiddenException('Invitation email does not match the authenticated account');
    return this.db.$transaction(async (tx) => {
      const claimed = await tx.workspaceInvitation.updateMany({ where: { id: invitation.id, acceptedAt: null, revokedAt: null, expiresAt: { gt: new Date() } }, data: { acceptedAt: new Date() } });
      if (claimed.count !== 1) throw new ConflictException('Invitation has already been accepted');
      await tx.organizationMember.upsert({ where: { userId_organizationId: { userId, organizationId: invitation.organizationId } }, update: {}, create: { userId, organizationId: invitation.organizationId, role: 'MEMBER' } });
      await tx.workspaceMember.upsert({ where: { workspaceId_userId: { workspaceId: invitation.workspaceId, userId } }, update: { role: invitation.role, status: 'ACTIVE', suspendedAt: null }, create: { workspaceId: invitation.workspaceId, userId, role: invitation.role } });
      return { workspaceId: invitation.workspaceId, organizationId: invitation.organizationId, role: invitation.role };
    });
  }

  async listMembers(userId: string, workspaceId: string) { const access = await this.getAccess(userId, workspaceId); return this.db.workspaceMember.findMany({ where: { workspaceId }, orderBy: { createdAt: 'asc' }, include: { user: { select: { id: true, firstName: true, lastName: true, email: true, createdAt: true, organizationMemberships: { where: { organizationId: access.organizationId }, select: { role: true } } } } } }); }

  async updateMember(userId: string, workspaceId: string, memberId: string, dto: UpdateMemberRoleDto) {
    const access = await this.requireManager(userId, workspaceId);
    if (memberId === userId) throw new ForbiddenException('You cannot change your own workspace role');
    if (access.workspaceRole === 'ADMIN' && access.organizationRole === 'MEMBER' && dto.role === 'ADMIN') throw new ForbiddenException('Workspace admins may only assign AGENT or VIEWER');
    const member = await this.db.workspaceMember.findUnique({ where: { workspaceId_userId: { workspaceId, userId: memberId } } });
    if (!member) throw new NotFoundException('Workspace member not found');
    if (member.role === 'ADMIN' && dto.role !== 'ADMIN' && access.organizationRole === 'MEMBER') { const admins = await this.db.workspaceMember.count({ where: { workspaceId, role: 'ADMIN', status: 'ACTIVE' } }); if (admins <= 1) throw new ForbiddenException('The final workspace admin cannot be demoted'); }
    const updated = await this.db.workspaceMember.update({ where: { workspaceId_userId: { workspaceId, userId: memberId } }, data: { role: dto.role } });
    await this.audit?.record({ organizationId: access.organizationId, workspaceId, actorUserId: userId, action: 'member.role_changed', targetType: 'workspace_member', targetId: memberId, metadata: { role: dto.role } });
    return updated;
  }

  async suspendMember(userId: string, workspaceId: string, memberId: string): Promise<void> {
    const access = await this.requireManager(userId, workspaceId);
    if (memberId === userId) throw new ForbiddenException('You cannot suspend yourself');
    const member = await this.db.workspaceMember.findUnique({ where: { workspaceId_userId: { workspaceId, userId: memberId } } });
    if (!member) throw new NotFoundException('Workspace member not found');
    const orgMember = await this.db.organizationMember.findUnique({ where: { userId_organizationId: { userId: memberId, organizationId: access.organizationId } } });
    if (orgMember?.role === 'OWNER') throw new ForbiddenException('The organization owner cannot be suspended');
    if (member.role === 'ADMIN' && access.organizationRole === 'MEMBER') { const admins = await this.db.workspaceMember.count({ where: { workspaceId, role: 'ADMIN', status: 'ACTIVE' } }); if (admins <= 1) throw new ForbiddenException('The final workspace admin cannot be suspended'); }
    await this.db.workspaceMember.update({ where: { workspaceId_userId: { workspaceId, userId: memberId } }, data: { status: 'SUSPENDED', suspendedAt: new Date() } });
    await this.audit?.record({ organizationId: access.organizationId, workspaceId, actorUserId: userId, action: 'member.suspended', targetType: 'workspace_member', targetId: memberId });
  }

  async reactivateMember(userId: string, workspaceId: string, memberId: string): Promise<void> {
    await this.requireManager(userId, workspaceId);
    const member = await this.db.workspaceMember.findUnique({ where: { workspaceId_userId: { workspaceId, userId: memberId } } });
    if (!member) throw new NotFoundException('Workspace member not found');
    await this.db.workspaceMember.update({ where: { workspaceId_userId: { workspaceId, userId: memberId } }, data: { status: 'ACTIVE', suspendedAt: null } });
    const access = await this.requireManager(userId, workspaceId);
    await this.audit?.record({ organizationId: access.organizationId, workspaceId, actorUserId: userId, action: 'member.reactivated', targetType: 'workspace_member', targetId: memberId });
  }

  async removeMember(userId: string, workspaceId: string, memberId: string): Promise<void> {
    const access = await this.requireManager(userId, workspaceId);
    if (memberId === userId) throw new ForbiddenException('You cannot remove yourself from the workspace');
    const member = await this.db.workspaceMember.findUnique({ where: { workspaceId_userId: { workspaceId, userId: memberId } } });
    if (!member) throw new NotFoundException('Workspace member not found');
    const orgMember = await this.db.organizationMember.findUnique({ where: { userId_organizationId: { userId: memberId, organizationId: access.organizationId } } });
    if (orgMember?.role === 'OWNER') throw new ForbiddenException('The organization owner cannot be removed from a workspace');
    if (member.role === 'ADMIN' && access.organizationRole === 'MEMBER') { const admins = await this.db.workspaceMember.count({ where: { workspaceId, role: 'ADMIN' } }); if (admins <= 1) throw new ForbiddenException('The final workspace admin cannot be removed'); }
    await this.db.workspaceMember.delete({ where: { workspaceId_userId: { workspaceId, userId: memberId } } });
    await this.audit?.record({ organizationId: access.organizationId, workspaceId, actorUserId: userId, action: 'member.removed', targetType: 'workspace_member', targetId: memberId });
    void this.events?.publish(workspaceId, 'member.removed', { memberId, removedByUserId: userId });
  }
}
