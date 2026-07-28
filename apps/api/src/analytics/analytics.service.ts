import { Inject, Injectable } from '@nestjs/common';
import type { PrismaClient } from '@resolveai/database';
// Nest dependency injection needs this service constructor at runtime.
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { WorkspaceAccessService } from '../workspace-access/workspace-access.service';

type DayRow = { date: string; total: number; ai: number; human: number };
type WidgetTokenRow = { createdAt: Date; role: string; status: string; inputTokens: number | null; outputTokens: number | null };
const day = (date: Date): string => date.toISOString().slice(0, 10);

@Injectable()
export class AnalyticsService {
  constructor(@Inject('PRISMA') private readonly db: PrismaClient, private readonly access: WorkspaceAccessService) {}

  async get(userId: string, workspaceId: string) {
    await this.access.assertMember(userId, workspaceId);
    const since = new Date(); since.setDate(since.getDate() - 30);
    const [aiConversations, widgetConversations, activeDocuments, activeAgents, aiMessages, widgetMessages] = await Promise.all([
      this.db.aIConversation.findMany({ where: { workspaceId, deletedAt: null, createdAt: { gte: since } }, select: { createdAt: true } }),
      this.db.widgetConversation.findMany({ where: { workspaceId, createdAt: { gte: since } }, select: { createdAt: true } }),
      this.db.knowledgeDocument.count({ where: { workspaceId, status: 'READY', deletedAt: null } }),
      this.db.aIAgent.count({ where: { workspaceId, status: 'ACTIVE', deletedAt: null } }),
      this.db.aIMessage.findMany({ where: { workspaceId, role: 'ASSISTANT', status: 'COMPLETE', createdAt: { gte: since } }, select: { createdAt: true, inputTokens: true, outputTokens: true } }),
      // Widget messages predate the shared AI message enum in some local
      // databases, so read their enum values as text for compatibility.
      this.db.$queryRaw<WidgetTokenRow[]>`SELECT "createdAt", "role"::text AS "role", "status"::text AS "status", "inputTokens", "outputTokens" FROM "WidgetMessage" WHERE "workspaceId" = ${workspaceId}::uuid AND "createdAt" >= ${since}`,
    ]);
    const byDate = new Map<string, DayRow>();
    for (const item of aiConversations) { const key = day(item.createdAt); const row = byDate.get(key) ?? { date: key, total: 0, ai: 0, human: 0 }; row.total += 1; row.ai += 1; byDate.set(key, row); }
    for (const item of widgetConversations) { const key = day(item.createdAt); const row = byDate.get(key) ?? { date: key, total: 0, ai: 0, human: 0 }; row.total += 1; row.ai += 1; byDate.set(key, row); }
    const messages = [...aiMessages, ...widgetMessages.filter((item) => item.role === 'ASSISTANT' && item.status === 'COMPLETE')];
    const inputTokens = messages.reduce((sum, item) => sum + (item.inputTokens ?? 0), 0);
    const outputTokens = messages.reduce((sum, item) => sum + (item.outputTokens ?? 0), 0);
    return {
      range: { days: 30, since },
      kpis: { totalConversations: aiConversations.length + widgetConversations.length, aiResolved: 0, humanHandoffs: 0, averageResponseTimeSeconds: null, activeDocuments, activeAgents },
      conversationsOverTime: [...byDate.values()].sort((left, right) => left.date.localeCompare(right.date)),
      tokenUsage: { inputTokens, outputTokens, totalTokens: inputTokens + outputTokens },
      knowledge: { retrievalSuccessRate: null, failedRetrievals: 0, topDocuments: [] },
      inbox: { open: widgetConversations.length, assigned: 0, closed: 0 },
    };
  }
}
