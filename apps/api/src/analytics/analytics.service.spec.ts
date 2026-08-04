import { AnalyticsService } from './analytics.service';

describe('AnalyticsService', () => {
  it('aggregates workspace-scoped live conversation, retrieval, and usage metrics', async () => {
    // Arrange
    const now = new Date();
    const db = {
      aIConversation: { findMany: jest.fn().mockResolvedValue([{ createdAt: now }]) },
      widgetConversation: { findMany: jest.fn().mockResolvedValue([{ createdAt: now, mode: 'HUMAN', status: 'RESOLVED', assignedUserId: 'user-1', resolvedAt: now }]) },
      knowledgeDocument: { count: jest.fn().mockResolvedValue(2) },
      aIAgent: { count: jest.fn().mockResolvedValue(1) },
      aIMessage: { findMany: jest.fn().mockResolvedValue([{ conversationId: 'conversation-1', role: 'USER', status: 'COMPLETE', createdAt: new Date(now.getTime() - 1000), inputTokens: null, outputTokens: null, sources: [] }, { conversationId: 'conversation-1', role: 'ASSISTANT', status: 'COMPLETE', createdAt: now, inputTokens: 10, outputTokens: 20, sources: [{ documentId: 'document-1', documentNameSnapshot: 'Handbook.md' }] }]) },
      widgetMessage: { findMany: jest.fn().mockResolvedValue([]) },
    };
    const access = { assertMember: jest.fn().mockResolvedValue(undefined) };
    const service = new AnalyticsService(db as never, access as never);

    // Act
    const result = await service.get('user-1', 'workspace-1');

    // Assert
    expect(result.kpis).toMatchObject({ totalConversations: 2, humanHandoffs: 1, activeDocuments: 2, activeAgents: 1 });
    expect(result.tokenUsage.totalTokens).toBe(30);
    expect(result.knowledge).toMatchObject({ retrievalSuccessRate: 1, failedRetrievals: 0 });
    expect(result.knowledge.topDocuments[0]).toMatchObject({ documentId: 'document-1', references: 1 });
    expect(result.inbox).toEqual({ open: 0, assigned: 0, closed: 1 });
    expect(access.assertMember).toHaveBeenCalledWith('user-1', 'workspace-1');
  });
  it('applies the requested analytics range to workspace queries', async () => {
    const now = new Date();
    const db = {
      aIConversation: { findMany: jest.fn().mockResolvedValue([]) }, widgetConversation: { findMany: jest.fn().mockResolvedValue([]) },
      knowledgeDocument: { count: jest.fn().mockResolvedValue(0) }, aIAgent: { count: jest.fn().mockResolvedValue(0) },
      aIMessage: { findMany: jest.fn().mockResolvedValue([]) }, widgetMessage: { findMany: jest.fn().mockResolvedValue([]) },
    };
    const service = new AnalyticsService(db as never, { assertMember: jest.fn().mockResolvedValue(undefined) } as never);
    const result = await service.get('user-1', 'workspace-1', { days: 7 });
    expect(result.range.days).toBe(7);
    expect(db.aIConversation.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ createdAt: { gte: expect.any(Date) } }) }));
    expect((db.aIConversation.findMany.mock.calls[0][0] as { where: { createdAt: { gte: Date } } }).where.createdAt.gte.getTime()).toBeGreaterThan(now.getTime() - 8 * 24 * 60 * 60 * 1000);
  });
});
