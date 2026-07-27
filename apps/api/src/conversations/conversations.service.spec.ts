import { ForbiddenException, NotFoundException } from '@nestjs/common';
import type { PrismaClient } from '@resolveai/database';
import { ConversationsService } from './conversations.service';
import type { GroundedAnswerService } from '../knowledge/grounded-answer.service';
import type { WorkspaceAccessService } from '../workspace-access/workspace-access.service';
import type { AgentsService } from '../agents/agents.service';

const agent = { id: 'agent-1', workspaceId: 'workspace-1', createdByUserId: 'user-1', name: 'Support Agent', description: 'Grounded support', instructions: 'Use the sources.', greeting: 'Hi', fallbackMessage: 'No answer.', model: 'gpt-4o-mini', temperature: 0.2, maxOutputTokens: 800, status: 'ACTIVE', isDefault: true, createdAt: new Date('2026-01-01'), updatedAt: new Date('2026-01-01'), deletedAt: null };
const conversation = { id: 'conversation-1', workspaceId: 'workspace-1', createdByUserId: 'user-1', title: 'New conversation', status: 'ACTIVE', agentId: 'agent-1', agent, createdAt: new Date('2026-01-01'), updatedAt: new Date('2026-01-01'), lastMessageAt: new Date('2026-01-01'), generationLockAt: null, deletedAt: null };
const source = { number: 1, documentId: 'document-1', chunkId: 'chunk-1', documentName: 'Refund policy', chunkIndex: 0, contentPreview: 'Refunds are available within 30 days.', similarityScore: 0.92, cited: true };

function setup() {
  const db = {
    aIConversation: {
      create: jest.fn().mockResolvedValue(conversation),
      findFirst: jest.fn().mockResolvedValue(conversation),
      findMany: jest.fn().mockResolvedValue([]),
      count: jest.fn().mockResolvedValue(0),
      update: jest.fn().mockResolvedValue(conversation),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
    aIMessage: {
      create: jest.fn().mockResolvedValueOnce({ id: 'user-message-1', createdAt: new Date('2026-01-02') }).mockResolvedValueOnce({ id: 'assistant-message-1' }),
      findMany: jest.fn().mockResolvedValue([]),
      findFirst: jest.fn().mockResolvedValue({ id: 'assistant-message-1', conversationId: 'conversation-1', workspaceId: 'workspace-1', userId: null, role: 'ASSISTANT', content: 'Refunds are available within 30 days. [1]', status: 'COMPLETE', provider: 'deterministic-test', model: 'deterministic-v1', inputTokens: 10, outputTokens: 8, errorCode: null, createdAt: new Date('2026-01-02'), sources: [{ id: 'source-1', sourceNumber: 1, documentId: 'document-1', chunkId: 'chunk-1', documentNameSnapshot: 'Refund policy', chunkIndexSnapshot: 0, contentPreview: 'Refunds are available within 30 days.', similarityScore: 0.92, cited: true }] }),
      update: jest.fn().mockResolvedValue({}),
      count: jest.fn().mockResolvedValue(0),
    },
    aIMessageSource: { createMany: jest.fn().mockResolvedValue({ count: 1 }) },
    $transaction: jest.fn(async (action: unknown) => {
      if (typeof action === 'function') return action(db);
      return Promise.all(action as Promise<unknown>[]);
    }),
  };
  const access = { getAccess: jest.fn().mockResolvedValue({ organizationId: 'org-1', organizationRole: 'OWNER', workspaceRole: 'ADMIN' }), assertMember: jest.fn().mockResolvedValue(undefined) };
  const grounded = {
    prepare: jest.fn().mockResolvedValue({ question: 'What is the refund policy?', selected: [{ chunkId: 'chunk-1', chunkIndex: 0, content: 'Refunds are available within 30 days.', similarityScore: 0.92, document: { id: 'document-1', name: 'Refund policy' } }], context: '[Source 1]', instructions: 'Use sources', maximumOutputTokens: 300, insufficient: false }),
    streamPrepared: jest.fn(async function* () { yield { type: 'response.started' as const }; yield { type: 'response.delta' as const, delta: 'Refunds are available within 30 days. [1]' }; yield { type: 'response.completed' as const, usage: { inputTokens: 10, outputTokens: 8 } }; }),
    sourcesFor: jest.fn().mockReturnValue([source]),
    providerMetadata: jest.fn().mockReturnValue({ provider: 'deterministic-test', model: 'deterministic-v1' }),
  };
  const agents = { ensureDefault: jest.fn().mockResolvedValue(agent), requireActiveForConversation: jest.fn().mockResolvedValue(agent), requireActiveForGeneration: jest.fn().mockResolvedValue(agent) };
  return { db, access, grounded, agents, service: new ConversationsService(db as unknown as PrismaClient, access as unknown as WorkspaceAccessService, grounded as unknown as GroundedAnswerService, agents as unknown as AgentsService) };
}

describe('ConversationsService', () => {
  it('creates a workspace-scoped conversation for a member who can write', async () => {
    // Arrange
    const { service, db } = setup();
    // Act
    const result = await service.create('user-1', 'workspace-1', {});
    // Assert
    expect(db.aIConversation.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ workspaceId: 'workspace-1', createdByUserId: 'user-1', title: 'New conversation' }) }));
    expect(result.workspaceId).toBe('workspace-1');
  });

  it('rejects viewers from creating conversations', async () => {
    // Arrange
    const { service, access } = setup();
    access.getAccess.mockResolvedValue({ organizationId: 'org-1', organizationRole: 'MEMBER', workspaceRole: 'VIEWER' });
    // Act / Assert
    await expect(service.create('user-1', 'workspace-1', {})).rejects.toThrow(ForbiddenException);
  });

  it('persists the user message before streaming and completes the assistant with safe sources', async () => {
    // Arrange
    const { service, db, grounded } = setup();
    // Act
    const events = [];
    for await (const event of service.stream('user-1', 'workspace-1', 'conversation-1', { content: 'What is the refund policy?' }, new AbortController().signal)) events.push(event);
    // Assert
    expect(db.aIMessage.create).toHaveBeenNthCalledWith(1, expect.objectContaining({ data: expect.objectContaining({ role: 'USER', status: 'COMPLETE', workspaceId: 'workspace-1' }) }));
    expect(db.aIMessage.create).toHaveBeenNthCalledWith(2, expect.objectContaining({ data: expect.objectContaining({ role: 'ASSISTANT', status: 'PENDING' }) }));
    expect(events.map((event) => event.type)).toEqual(['message.started', 'message.delta', 'sources', 'message.completed']);
    expect(db.aIMessageSource.createMany).toHaveBeenCalledWith(expect.objectContaining({ data: [expect.objectContaining({ documentId: 'document-1', chunkId: 'chunk-1', cited: true })] }));
    expect(grounded.streamPrepared).toHaveBeenCalled();
  });

  it('stores a complete insufficient-context answer without calling generation', async () => {
    // Arrange
    const { service, grounded } = setup();
    grounded.prepare.mockResolvedValue({ question: 'Unknown', selected: [], sources: [], context: '', instructions: 'Use sources', maximumOutputTokens: 300, insufficient: true });
    // Act
    const events = [];
    for await (const event of service.stream('user-1', 'workspace-1', 'conversation-1', { content: 'Unknown' }, new AbortController().signal)) events.push(event);
    // Assert
    expect(events.map((event) => event.type)).toEqual(['message.started', 'message.delta', 'sources', 'message.completed']);
    expect(grounded.streamPrepared).not.toHaveBeenCalled();
  });

  it('marks a provider failure as failed and never exposes provider events', async () => {
    // Arrange
    const { service, db, grounded } = setup();
    grounded.streamPrepared.mockImplementation(async function* () { yield { type: 'response.failed' as const, errorCode: 'TIMEOUT' }; });
    // Act
    const events = [];
    for await (const event of service.stream('user-1', 'workspace-1', 'conversation-1', { content: 'Will this fail safely?' }, new AbortController().signal)) events.push(event);
    // Assert
    expect(events.map((event) => event.type)).toEqual(['message.started', 'message.failed']);
    expect(events.some((event) => 'event' in event)).toBe(false);
    expect(db.aIMessage.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: 'FAILED', errorCode: 'GENERATION_FAILED' }) }));
  });

  it('rejects a second active generation for the same conversation', async () => {
    // Arrange
    const { service, db } = setup();
    db.aIConversation.updateMany.mockResolvedValue({ count: 0 });
    // Act / Assert
    await expect((async () => { for await (const _event of service.stream('user-1', 'workspace-1', 'conversation-1', { content: 'Duplicate?' }, new AbortController().signal)) { /* consume */ } })()).rejects.toThrow('already generating');
  });

  it('rejects access to a deleted or cross-workspace conversation', async () => {
    // Arrange
    const { service, db } = setup();
    db.aIConversation.findFirst.mockResolvedValue(null);
    // Act / Assert
    await expect(service.detail('user-1', 'other-workspace', 'conversation-1', {})).rejects.toThrow(NotFoundException);
  });
});
