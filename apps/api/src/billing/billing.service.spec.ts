import { ForbiddenException } from '@nestjs/common';
import { BillingService } from './billing.service';
import { BillingUsageService, planLimits } from './billing-usage.service';
import type { BillingProvider } from './billing.provider';

function database() {
  return {
    $queryRaw: jest.fn().mockResolvedValue([{ count: 0n, inputTokens: 0, outputTokens: 0 }]),
    workspaceSubscription: {
      upsert: jest.fn().mockResolvedValue({ workspaceId: 'workspace-1', plan: 'FREE', status: 'ACTIVE', currentPeriodEnd: new Date('2026-08-01'), renewalDate: new Date('2026-08-01'), providerSubscriptionId: null }),
      update: jest.fn().mockResolvedValue({ workspaceId: 'workspace-1', plan: 'PRO', status: 'ACTIVE' }),
    },
    aIMessage: { count: jest.fn().mockResolvedValue(0), aggregate: jest.fn().mockResolvedValue({ _sum: { inputTokens: 0, outputTokens: 0 } }) },
    widgetMessage: { count: jest.fn().mockResolvedValue(0), aggregate: jest.fn().mockResolvedValue({ _sum: { inputTokens: 0, outputTokens: 0 } }) },
    aIConversation: { count: jest.fn().mockResolvedValue(0) },
    knowledgeDocument: { count: jest.fn().mockResolvedValue(0), aggregate: jest.fn().mockResolvedValue({ _sum: { sizeBytes: 0 } }) },
    workspaceMember: { count: jest.fn().mockResolvedValue(0) },
  };
}

describe('BillingUsageService', () => {
  it('rejects a document when the free plan limit is reached', async () => {
    // Arrange
    const db = database(); db.knowledgeDocument.count.mockResolvedValue(10);
    const service = new BillingUsageService(db as never);

    // Act / Assert
    await expect(service.assertCanConsume('workspace-1', 'DOCUMENTS')).rejects.toThrow(new ForbiddenException('The free plan limit for documents has been reached'));
  });

  it('keeps enterprise usage unlimited', async () => {
    // Arrange
    const db = database(); db.workspaceSubscription.upsert.mockResolvedValue({ workspaceId: 'workspace-1', plan: 'ENTERPRISE', status: 'ACTIVE', currentPeriodEnd: new Date('2026-08-01'), renewalDate: null, providerSubscriptionId: null }); db.knowledgeDocument.count.mockResolvedValue(100_000);
    const service = new BillingUsageService(db as never);

    // Act / Assert
    await expect(service.assertCanConsume('workspace-1', 'DOCUMENTS', 1_000)).resolves.toBeUndefined();
    expect(planLimits.ENTERPRISE.documents).toBeNull();
  });
});

describe('BillingService', () => {
  it('allows only organization admins to change plans through the provider abstraction', async () => {
    // Arrange
    const db = database();
    const access = { getAccess: jest.fn().mockResolvedValue({ organizationRole: 'OWNER' }), assertMember: jest.fn() };
    const usage = { ensureSubscription: jest.fn().mockResolvedValue({ workspaceId: 'workspace-1', currentPeriodEnd: new Date('2026-08-01'), providerSubscriptionId: null }) };
    const provider: BillingProvider = { changePlan: jest.fn().mockResolvedValue({ provider: 'mock', providerSubscriptionId: 'mock-sub', plan: 'PRO' }) };
    const service = new BillingService(db as never, access as never, usage as never, provider);

    // Act
    await service.changePlan('user-1', 'workspace-1', { plan: 'PRO' });

    // Assert
    expect(provider.changePlan).toHaveBeenCalledWith(expect.objectContaining({ workspaceId: 'workspace-1', plan: 'PRO' }));
    expect(db.workspaceSubscription.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ plan: 'PRO', provider: 'mock' }) }));
    access.getAccess.mockResolvedValue({ organizationRole: 'MEMBER' });
    await expect(service.changePlan('user-1', 'workspace-1', { plan: 'PRO' })).rejects.toThrow(ForbiddenException);
  });
});
