import { ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { WorkspaceAccessService } from './workspace-access.service';
import { EmailService } from './email.service';

type MockDb = {
  workspace: { findFirst: jest.Mock };
  organizationMember: { findUnique: jest.Mock; upsert: jest.Mock };
  workspaceMember: { findUnique: jest.Mock; upsert: jest.Mock; findMany: jest.Mock; update: jest.Mock; count: jest.Mock; delete: jest.Mock };
  user: { findUnique: jest.Mock };
  workspaceInvitation: { findFirst: jest.Mock; findUnique: jest.Mock; create: jest.Mock; update: jest.Mock; updateMany: jest.Mock; findMany: jest.Mock };
  $transaction: jest.Mock;
};

function database(): MockDb {
  const db: MockDb = {
    workspace: { findFirst: jest.fn() },
    organizationMember: { findUnique: jest.fn(), upsert: jest.fn() },
    workspaceMember: { findUnique: jest.fn(), upsert: jest.fn(), findMany: jest.fn(), update: jest.fn(), count: jest.fn(), delete: jest.fn() },
    user: { findUnique: jest.fn() },
    workspaceInvitation: { findFirst: jest.fn(), findUnique: jest.fn(), create: jest.fn(), update: jest.fn(), updateMany: jest.fn(), findMany: jest.fn() },
    $transaction: jest.fn(),
  };
  db.workspace.findFirst.mockResolvedValue({ organizationId: 'org-1' });
  db.organizationMember.findUnique.mockResolvedValue({ role: 'ADMIN' });
  db.workspaceMember.findUnique.mockResolvedValue({ role: 'ADMIN' });
  return db;
}

describe('WorkspaceAccessService', () => {
  it('denies an agent from creating an invitation', async () => {
    // Arrange
    const db = database(); db.organizationMember.findUnique.mockResolvedValue({ role: 'MEMBER' }); db.workspaceMember.findUnique.mockResolvedValue({ role: 'AGENT' });
    const service = new WorkspaceAccessService(db as never, new EmailService());

    // Act
    const action = service.createInvitation('agent-1', 'workspace-1', { email: 'new@example.com', role: 'AGENT' });

    // Assert
    await expect(action).rejects.toThrow(new ForbiddenException('Insufficient workspace permissions'));
  });

  it('stores only a token hash and rejects a duplicate active invitation', async () => {
    // Arrange
    const db = database(); db.user.findUnique.mockResolvedValue(null); db.workspaceInvitation.findFirst.mockResolvedValue(null); db.workspaceInvitation.create.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({ ...data, id: 'inv-1', workspace: { name: 'Support' }, organization: { name: 'Acme' }, invitedBy: { firstName: 'Owner', lastName: 'One' } }));
    const email = { sendInvitation: jest.fn() } as unknown as EmailService; const service = new WorkspaceAccessService(db as never, email);

    // Act
    const result = await service.createInvitation('owner-1', 'workspace-1', { email: 'Invitee@Example.com', role: 'AGENT' });

    // Assert
    const createCall = db.workspaceInvitation.create.mock.calls[0][0] as { data: Record<string, unknown> };
    expect(createCall.data.email).toBe('invitee@example.com'); expect(createCall.data.tokenHash).toEqual(expect.any(String)); expect(createCall.data).not.toHaveProperty('token'); expect(result.localInvitationUrl).toContain('/invite/');
    db.workspaceInvitation.findFirst.mockResolvedValue({ id: 'inv-existing' });
    await expect(service.createInvitation('owner-1', 'workspace-1', { email: 'invitee@example.com', role: 'AGENT' })).rejects.toThrow(new ConflictException('An active invitation already exists for this email'));
  });

  it('accepts an invitation transactionally and preserves an existing organization role', async () => {
    // Arrange
    const db = database(); const invitation = { id: 'inv-1', workspaceId: 'workspace-1', organizationId: 'org-1', email: 'member@example.com', role: 'VIEWER', expiresAt: new Date(Date.now() + 60_000), acceptedAt: null, revokedAt: null };
    db.workspaceInvitation.findFirst.mockResolvedValue(invitation); db.user.findUnique.mockResolvedValue({ email: 'MEMBER@example.com' }); db.workspaceInvitation.updateMany.mockResolvedValue({ count: 1 });
    db.$transaction.mockImplementation((callback: (tx: MockDb) => unknown) => callback(db));
    const service = new WorkspaceAccessService(db as never, new EmailService());

    // Act
    const result = await service.acceptInvitation('member-1', 'raw-invitation-token-value');

    // Assert
    expect(result).toEqual({ workspaceId: 'workspace-1', organizationId: 'org-1', role: 'VIEWER' }); expect(db.organizationMember.upsert).toHaveBeenCalledWith(expect.objectContaining({ update: {} })); expect(db.workspaceMember.upsert).toHaveBeenCalledWith(expect.objectContaining({ create: expect.objectContaining({ role: 'VIEWER' }) }));
    db.workspaceInvitation.findFirst.mockResolvedValue({ ...invitation, acceptedAt: new Date() });
    await expect(service.acceptInvitation('member-1', 'raw-invitation-token-value')).rejects.toThrow(new NotFoundException('Invitation is invalid or expired'));
  });
});
