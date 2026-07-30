import { ForbiddenException, Inject, Injectable } from '@nestjs/common';
import type { PrismaClient } from '@resolveai/database';

export type UsageMetric = 'AI_REQUESTS' | 'TOKENS' | 'CONVERSATIONS' | 'DOCUMENTS' | 'STORAGE' | 'TEAM_MEMBERS';
export type PlanName = 'FREE' | 'STARTER' | 'PRO' | 'BUSINESS' | 'ENTERPRISE';
type LimitValue = number | null;
type CountRow = { count: bigint };
type TokenRow = { inputTokens: number | null; outputTokens: number | null };

export type BillingLimits = { aiRequests: LimitValue; tokens: LimitValue; conversations: LimitValue; documents: LimitValue; storageBytes: LimitValue; teamMembers: LimitValue };

export const planLimits: Record<PlanName, BillingLimits> = {
  FREE: { aiRequests: 100, tokens: 50_000, conversations: 100, documents: 10, storageBytes: 50 * 1024 * 1024, teamMembers: 3 },
  STARTER: { aiRequests: 2_000, tokens: 500_000, conversations: 2_000, documents: 100, storageBytes: 5 * 1024 * 1024 * 1024, teamMembers: 10 },
  PRO: { aiRequests: 10_000, tokens: 5_000_000, conversations: 10_000, documents: 1_000, storageBytes: 25 * 1024 * 1024 * 1024, teamMembers: 50 },
  BUSINESS: { aiRequests: 50_000, tokens: 25_000_000, conversations: 50_000, documents: 5_000, storageBytes: 100 * 1024 * 1024 * 1024, teamMembers: 250 },
  ENTERPRISE: { aiRequests: null, tokens: null, conversations: null, documents: null, storageBytes: null, teamMembers: null },
};

const periodStart = (): Date => { const now = new Date(); return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)); };

@Injectable()
export class BillingUsageService {
  constructor(@Inject('PRISMA') private readonly db: PrismaClient) {}

  async ensureSubscription(workspaceId: string) {
    const start = periodStart();
    const end = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 1));
    return this.db.workspaceSubscription.upsert({ where: { workspaceId }, update: { provider: 'stripe' }, create: { workspaceId, currentPeriodStart: start, currentPeriodEnd: end, renewalDate: end, provider: 'stripe' } });
  }

  async usage(workspaceId: string, since = periodStart()) {
    const [subscription, aiRequests, widgetRequests, aiTokens, widgetTokens, conversations, documents, storage, teamMembers] = await Promise.all([
      this.ensureSubscription(workspaceId),
      this.db.aIMessage.count({ where: { workspaceId, role: 'USER', createdAt: { gte: since } } }),
      this.db.$queryRaw<CountRow[]>`SELECT COUNT(*)::bigint AS "count" FROM "WidgetMessage" WHERE "workspaceId" = ${workspaceId}::uuid AND "createdAt" >= ${since} AND "role"::text = 'USER'`,
      this.db.aIMessage.aggregate({ where: { workspaceId, role: 'ASSISTANT', createdAt: { gte: since } }, _sum: { inputTokens: true, outputTokens: true } }),
      this.db.$queryRaw<TokenRow[]>`SELECT COALESCE(SUM("inputTokens"), 0)::int AS "inputTokens", COALESCE(SUM("outputTokens"), 0)::int AS "outputTokens" FROM "WidgetMessage" WHERE "workspaceId" = ${workspaceId}::uuid AND "createdAt" >= ${since} AND "role"::text = 'ASSISTANT'`,
      this.db.aIConversation.count({ where: { workspaceId, deletedAt: null, createdAt: { gte: since } } }),
      this.db.knowledgeDocument.count({ where: { workspaceId, deletedAt: null, createdAt: { gte: since } } }),
      this.db.knowledgeDocument.aggregate({ where: { workspaceId, deletedAt: null }, _sum: { sizeBytes: true } }),
      this.db.workspaceMember.count({ where: { workspaceId } }),
    ]);
    const inputTokens = (aiTokens._sum.inputTokens ?? 0) + (widgetTokens[0]?.inputTokens ?? 0);
    const outputTokens = (aiTokens._sum.outputTokens ?? 0) + (widgetTokens[0]?.outputTokens ?? 0);
    const plan = subscription.plan as PlanName;
    return { periodStart: since, periodEnd: subscription.currentPeriodEnd, plan, limits: planLimits[plan], values: { aiRequests: aiRequests + Number(widgetRequests[0]?.count ?? 0), tokens: inputTokens + outputTokens, inputTokens, outputTokens, conversations, documents, storageBytes: storage._sum.sizeBytes ?? 0, teamMembers } };
  }

  async assertCanConsume(workspaceId: string, metric: UsageMetric, amount = 1): Promise<void> {
    const current = await this.usage(workspaceId);
    const key = { AI_REQUESTS: 'aiRequests', TOKENS: 'tokens', CONVERSATIONS: 'conversations', DOCUMENTS: 'documents', STORAGE: 'storageBytes', TEAM_MEMBERS: 'teamMembers' }[metric] as keyof BillingLimits;
    const limit = current.limits[key];
    if (limit !== null && current.values[key] + amount > limit) throw new ForbiddenException(`The ${current.plan.toLowerCase()} plan limit for ${key} has been reached`);
  }
}
