import { Inject, Injectable } from '@nestjs/common';
import type { PrismaClient } from '@resolveai/database';
// Nest dependency injection needs this service constructor at runtime.
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { WorkspaceAccessService } from '../workspace-access/workspace-access.service';
import type { AnalyticsQueryDto } from './analytics.dto';

type DayRow = { date: string; total: number; ai: number; human: number };
type MessageRow = { conversationId: string; role: string; status: string; createdAt: Date; inputTokens: number | null; outputTokens: number | null; sources: Array<{ documentId: string; documentNameSnapshot: string }> };
const day = (date: Date): string => date.toISOString().slice(0, 10);

@Injectable()
export class AnalyticsService {
  constructor(@Inject('PRISMA') private readonly db: PrismaClient, private readonly access: WorkspaceAccessService) {}

  async get(userId: string, workspaceId: string, query: AnalyticsQueryDto = {}) {
    await this.access.assertMember(userId, workspaceId);
    const days = query.days ?? 30;
    const since = new Date(); since.setDate(since.getDate() - days);
    const [aiConversations, widgetConversations, activeDocuments, activeAgents, aiMessages, widgetMessages] = await Promise.all([
      this.db.aIConversation.findMany({ where: { workspaceId, deletedAt: null, createdAt: { gte: since } }, select: { createdAt: true } }),
      this.db.widgetConversation.findMany({ where: { workspaceId, createdAt: { gte: since } }, select: { createdAt: true, mode: true, status: true, assignedUserId: true, resolvedAt: true } }),
      this.db.knowledgeDocument.count({ where: { workspaceId, status: 'READY', deletedAt: null } }),
      this.db.aIAgent.count({ where: { workspaceId, status: 'ACTIVE', deletedAt: null } }),
      this.db.aIMessage.findMany({ where: { workspaceId, createdAt: { gte: since } }, select: { conversationId: true, role: true, status: true, createdAt: true, inputTokens: true, outputTokens: true, sources: { select: { documentId: true, documentNameSnapshot: true } } }, orderBy: { createdAt: 'asc' } }),
      this.db.widgetMessage.findMany({ where: { workspaceId, createdAt: { gte: since } }, select: { conversationId: true, role: true, status: true, createdAt: true, inputTokens: true, outputTokens: true, sources: { select: { documentId: true, documentNameSnapshot: true } } }, orderBy: { createdAt: 'asc' } }),
    ]);
    const messages: MessageRow[] = [...aiMessages, ...widgetMessages].map((message) => ({ ...message, role: String(message.role), status: String(message.status) }));
    const byDate = new Map<string, DayRow>();
    for (const item of aiConversations) { const key = day(item.createdAt); const row = byDate.get(key) ?? { date: key, total: 0, ai: 0, human: 0 }; row.total += 1; row.ai += 1; byDate.set(key, row); }
    for (const item of widgetConversations) { const key = day(item.createdAt); const row = byDate.get(key) ?? { date: key, total: 0, ai: 0, human: 0 }; row.total += 1; if (item.mode === 'HUMAN') row.human += 1; else row.ai += 1; byDate.set(key, row); }
    const assistantMessages = messages.filter((message) => message.role === 'ASSISTANT' && message.status === 'COMPLETE');
    const inputTokens = assistantMessages.reduce((sum, message) => sum + (message.inputTokens ?? 0), 0);
    const outputTokens = assistantMessages.reduce((sum, message) => sum + (message.outputTokens ?? 0), 0);
    const sourceMessages = assistantMessages.filter((message) => message.sources.length > 0);
    const retrievalSuccessRate = assistantMessages.length ? sourceMessages.length / assistantMessages.length : null;
    const topDocuments = new Map<string, { documentId: string; documentName: string; references: number }>();
    for (const message of sourceMessages) for (const source of message.sources) { const current = topDocuments.get(source.documentId) ?? { documentId: source.documentId, documentName: source.documentNameSnapshot, references: 0 }; current.references += 1; topDocuments.set(source.documentId, current); }
    const responseTimes: number[] = [];
    const grouped = new Map<string, MessageRow[]>();
    for (const message of messages) grouped.set(message.conversationId, [...(grouped.get(message.conversationId) ?? []), message]);
    for (const conversationMessages of grouped.values()) { let userAt: Date | null = null; for (const message of conversationMessages) { if (message.role === 'USER') userAt = message.createdAt; if (userAt && message.role === 'ASSISTANT' && message.status === 'COMPLETE') { responseTimes.push((message.createdAt.getTime() - userAt.getTime()) / 1000); userAt = null; } } }
    const humanHandoffs = widgetConversations.filter((conversation) => conversation.mode === 'HUMAN').length;
    const resolved = widgetConversations.filter((conversation) => conversation.status === 'RESOLVED').length;
    return {
      range: { days, since },
      kpis: { totalConversations: aiConversations.length + widgetConversations.length, aiResolved: Math.max(0, assistantMessages.length - humanHandoffs), humanHandoffs, averageResponseTimeSeconds: responseTimes.length ? responseTimes.reduce((sum, value) => sum + value, 0) / responseTimes.length : null, activeDocuments, activeAgents },
      conversationsOverTime: [...byDate.values()].sort((left, right) => left.date.localeCompare(right.date)),
      tokenUsage: { inputTokens, outputTokens, totalTokens: inputTokens + outputTokens },
      knowledge: { retrievalSuccessRate, failedRetrievals: assistantMessages.length - sourceMessages.length, topDocuments: [...topDocuments.values()].sort((left, right) => right.references - left.references).slice(0, 5) },
      inbox: { open: widgetConversations.filter((conversation) => conversation.status !== 'RESOLVED').length, assigned: widgetConversations.filter((conversation) => conversation.assignedUserId !== null && conversation.status !== 'RESOLVED').length, closed: resolved },
    };
  }
}
