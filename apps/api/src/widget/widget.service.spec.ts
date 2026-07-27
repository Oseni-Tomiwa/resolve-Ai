import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { WidgetService } from './widget.service';

const agent = { id: 'agent-1', name: 'Support Agent', description: 'Helpful', greeting: 'Hello', instructions: 'Use sources.', fallbackMessage: 'No answer.', model: 'gpt-4o-mini', temperature: 0.2, maxOutputTokens: 800, status: 'ACTIVE', deletedAt: null };
const configuration = { id: 'config-1', workspaceId: 'workspace-1', publicId: 'widget_public', enabled: true, name: 'Support', greeting: 'Welcome', accentColor: '#7ce7dc', position: 'BOTTOM_RIGHT', launcherLabel: 'Chat', allowedDomains: ['https://docs.example.com'], selectedAgentId: 'agent-1', selectedAgent: agent };

function makeService() {
  const db = { widgetConfiguration: { findUnique: jest.fn().mockResolvedValue(configuration), upsert: jest.fn(), update: jest.fn() }, widgetSession: { findFirst: jest.fn(), create: jest.fn(), update: jest.fn() }, widgetConversation: { create: jest.fn(), findFirst: jest.fn() }, aIAgent: { findMany: jest.fn().mockResolvedValue([agent]), findFirst: jest.fn().mockResolvedValue({ id: agent.id }) } };
  return { service: new WidgetService(db as never, {} as never), db };
}

describe('WidgetService', () => {
  it('returns only safe public configuration fields', async () => {
    const { service } = makeService();
    const result = await service.publicConfig('widget_public', { headers: { origin: 'https://docs.example.com' } });
    expect(result).toEqual(expect.objectContaining({ publicId: 'widget_public', name: 'Support', agent: { name: 'Support Agent', description: 'Helpful', greeting: 'Hello' } }));
    expect(result).not.toHaveProperty('workspaceId');
    expect(result).not.toHaveProperty('selectedAgentId');
    expect(result).not.toHaveProperty('agent.instructions');
  });

  it('rejects an unauthorized widget origin', async () => {
    const { service } = makeService();
    await expect(service.publicConfig('widget_public', { headers: { origin: 'https://evil.example.com' } })).rejects.toThrow(ForbiddenException);
  });

  it('rejects a missing widget without leaking workspace details', async () => {
    const { service, db } = makeService();
    db.widgetConfiguration.findUnique.mockResolvedValue(null);
    await expect(service.publicConfig('unknown', { headers: {} })).rejects.toThrow(NotFoundException);
  });

  it('does not create a second session when an opaque session token is valid for the same widget', async () => {
    const { service, db } = makeService();
    db.widgetSession.findFirst.mockResolvedValue({ id: 'session-1', expiresAt: new Date(Date.now() + 60_000) });
    const result = await service.createSession('widget_public', { sessionId: 'opaque-session-token-1234567890' }, { headers: { origin: 'https://docs.example.com' } });
    expect(result.sessionId).toBe('opaque-session-token-1234567890');
    expect(db.widgetSession.create).not.toHaveBeenCalled();
  });
});
