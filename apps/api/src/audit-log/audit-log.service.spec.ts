import { AuditLogService } from './audit-log.service';

describe('AuditLogService', () => {
  it('writes sanitized workspace events and returns paginated isolated entries', async () => {
    const create = jest.fn().mockResolvedValue({});
    const findUnique = jest.fn().mockResolvedValue({ organizationId: 'org-1' });
    const org = jest.fn().mockResolvedValue({ role: 'OWNER' });
    const member = jest.fn().mockResolvedValue({ status: 'ACTIVE', role: 'ADMIN' });
    const findMany = jest.fn().mockResolvedValue([{ id: 'audit-1', action: 'member.invited', targetType: 'workspace_invitation', targetId: 'invite-1', metadata: { role: 'AGENT' }, requestId: 'req-1', createdAt: new Date(0), actorUser: { firstName: 'A', lastName: 'User', email: 'a@example.com' } }]);
    const count = jest.fn().mockResolvedValue(1);
    const db = { auditLog: { create, findMany, count }, workspace: { findUnique }, organizationMember: { findUnique: org }, workspaceMember: { findUnique: member }, $transaction: jest.fn((queries: unknown[]) => Promise.all(queries)) };
    const service = new AuditLogService(db as never);
    await service.record({ organizationId: 'org-1', workspaceId: 'ws-1', action: 'member.invited', targetType: 'workspace_invitation', metadata: { role: 'AGENT', token: 'never-store' } });
    const result = await service.list('user-1', 'ws-1', { page: 1, pageSize: 25 });
    expect(create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ metadata: { role: 'AGENT' } }) }));
    expect(result.total).toBe(1);
    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ organizationId: 'org-1', workspaceId: 'ws-1' }) }));
  });
});
