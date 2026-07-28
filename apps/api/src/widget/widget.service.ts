import { BadRequestException, ForbiddenException, HttpException, HttpStatus, Inject, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { createHash, randomBytes } from 'node:crypto';
import type { PrismaClient } from '@resolveai/database';
// Nest dependency injection needs the service constructor at runtime.
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { GroundedAnswerService, type PreparedGroundedAnswer } from '../knowledge/grounded-answer.service';
import type { UpdateWidgetConfigurationDto, WidgetConversationDto, WidgetMessageDto, WidgetSessionDto } from './widget.dto';

const sessionLifetimeMs = 24 * 60 * 60 * 1000;
const maxMessagesPerSession = 100;
const normalizeDomain = (value: string): string => value.trim().replace(/\/$/, '').toLowerCase();
const hash = (value: string): string => createHash('sha256').update(value).digest('hex');
const preview = (value: string): string => value.replace(/\s+/g, ' ').trim().slice(0, 240);
const agentDocumentSelection = { knowledgeDocuments: { select: { knowledgeDocumentId: true } } } as const;

type OriginRequest = { headers?: { origin?: string; 'x-forwarded-for'?: string | string[] } };

@Injectable()
export class WidgetService {
  private readonly rateLimits = new Map<string, number[]>();
  constructor(@Inject('PRISMA') private readonly db: PrismaClient, private readonly grounded: GroundedAnswerService) {}

  private async access(userId: string, workspaceId: string): Promise<void> {
    const workspace = await this.db.workspace.findUnique({ where: { id: workspaceId }, select: { organizationId: true } });
    if (!workspace) throw new NotFoundException('Workspace not found');
    const [organization, member] = await Promise.all([
      this.db.organizationMember.findUnique({ where: { userId_organizationId: { userId, organizationId: workspace.organizationId } } }),
      this.db.workspaceMember.findUnique({ where: { workspaceId_userId: { workspaceId, userId } } }),
    ]);
    if (!organization || (!member && !['OWNER', 'ADMIN'].includes(organization.role)) || (!['OWNER', 'ADMIN'].includes(organization.role) && member?.role !== 'ADMIN')) throw new ForbiddenException('Only workspace owners and admins can manage the widget');
  }

  private safeConfig(config: { publicId: string; enabled: boolean; name: string; greeting: string; accentColor: string; position: string; launcherLabel: string; allowedDomains: string[]; selectedAgent: { name: string; description: string | null; greeting: string | null } }) {
    return { publicId: config.publicId, enabled: config.enabled, name: config.name, greeting: config.greeting, accentColor: config.accentColor, position: config.position, launcherLabel: config.launcherLabel, agent: { name: config.selectedAgent.name, description: config.selectedAgent.description, greeting: config.selectedAgent.greeting } };
  }

  async getAdmin(userId: string, workspaceId: string) {
    await this.access(userId, workspaceId);
    const [configuration, agents] = await Promise.all([
      this.db.widgetConfiguration.findUnique({ where: { workspaceId }, include: { selectedAgent: { select: { name: true, description: true, greeting: true } } } }),
      this.db.aIAgent.findMany({ where: { workspaceId, status: 'ACTIVE', deletedAt: null }, select: { id: true, name: true, description: true, status: true, isDefault: true }, orderBy: [{ isDefault: 'desc' }, { name: 'asc' }] }),
    ]);
    return { configuration: configuration ? { ...this.safeConfig(configuration), id: configuration.id, workspaceId: configuration.workspaceId, selectedAgentId: configuration.selectedAgentId, allowedDomains: configuration.allowedDomains } : null, agents };
  }

  async updateAdmin(userId: string, workspaceId: string, dto: UpdateWidgetConfigurationDto) {
    await this.access(userId, workspaceId);
    const selectedAgentId = dto.selectedAgentId ?? (await this.db.widgetConfiguration.findUnique({ where: { workspaceId }, select: { selectedAgentId: true } }))?.selectedAgentId;
    if (!selectedAgentId) throw new BadRequestException('Select an active agent before configuring the widget');
    const selectedAgent = await this.db.aIAgent.findFirst({ where: { id: selectedAgentId, workspaceId, status: 'ACTIVE', deletedAt: null }, select: { id: true } });
    if (!selectedAgent) throw new BadRequestException('The selected agent must be active and belong to this workspace');
    const allowedDomains = dto.allowedDomains?.map(normalizeDomain).filter(Boolean) ?? undefined;
    const configuration = await this.db.widgetConfiguration.upsert({ where: { workspaceId }, create: { workspaceId, selectedAgentId, ...(dto as object), ...(allowedDomains ? { allowedDomains } : {}) }, update: { ...dto, ...(allowedDomains ? { allowedDomains } : {}), selectedAgentId } as never, include: { selectedAgent: { select: { name: true, description: true, greeting: true } } } });
    return { ...this.safeConfig(configuration), id: configuration.id, workspaceId, selectedAgentId: configuration.selectedAgentId, allowedDomains: configuration.allowedDomains };
  }

  async regenerate(userId: string, workspaceId: string) {
    await this.access(userId, workspaceId);
    const configuration = await this.db.widgetConfiguration.update({ where: { workspaceId }, data: { publicId: `w_${randomBytes(18).toString('base64url')}` }, include: { selectedAgent: { select: { name: true, description: true, greeting: true } } } });
    return this.safeConfig(configuration);
  }

  private origin(request: OriginRequest): string | undefined { const value = request.headers?.origin; return Array.isArray(value) ? value[0] : value; }
  private clientKey(request: OriginRequest): string { const value = request.headers?.['x-forwarded-for']; return Array.isArray(value) ? value[0] ?? 'unknown' : value?.split(',')[0]?.trim() ?? 'unknown'; }
  private assertRateLimit(key: string, max: number, windowMs: number): void { const now = Date.now(); const recent = (this.rateLimits.get(key) ?? []).filter((timestamp) => now - timestamp < windowMs); if (recent.length >= max) throw new HttpException('Please try again shortly', HttpStatus.TOO_MANY_REQUESTS); recent.push(now); this.rateLimits.set(key, recent); }

  private assertOrigin(config: { allowedDomains: string[] }, origin: string | undefined): void {
    if (!origin) return;
    const normalized = normalizeDomain(origin);
    if (config.allowedDomains.length === 0 && process.env.NODE_ENV !== 'production' && /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(normalized)) return;
    if (config.allowedDomains.length === 0 && process.env.NODE_ENV !== 'production') return;
    if (!config.allowedDomains.some((domain) => normalized === domain || normalized === `https://${domain}` || normalized === `http://${domain}`)) throw new ForbiddenException('This website is not authorized to use the widget');
  }

  private async publicConfiguration(publicId: string, request: OriginRequest, requireEnabled = true) {
    const configuration = await this.db.widgetConfiguration.findUnique({ where: { publicId }, include: { selectedAgent: { select: { id: true, name: true, description: true, greeting: true, instructions: true, fallbackMessage: true, model: true, temperature: true, topP: true, maxOutputTokens: true, requireCitations: true, groundedOnly: true, allowFollowUpQuestions: true, allowGeneralKnowledge: true, status: true, deletedAt: true, ...agentDocumentSelection } } } });
    if (!configuration || configuration.selectedAgent.status !== 'ACTIVE' || configuration.selectedAgent.deletedAt) throw new NotFoundException('Widget not found');
    this.assertOrigin(configuration, this.origin(request));
    if (requireEnabled && !configuration.enabled) throw new ForbiddenException('This widget is currently disabled');
    this.assertRateLimit(`${publicId}:${this.clientKey(request)}`, 60, 60_000);
    return configuration;
  }

  async publicConfig(publicId: string, request: OriginRequest) { return this.safeConfig(await this.publicConfiguration(publicId, request, false)); }

  async createSession(publicId: string, dto: WidgetSessionDto, request: OriginRequest) {
    const configuration = await this.publicConfiguration(publicId, request);
    const rawToken = dto.sessionId ?? randomBytes(32).toString('base64url');
    const existing = dto.sessionId ? await this.db.widgetSession.findFirst({ where: { tokenHash: hash(rawToken), widgetConfigurationId: configuration.id, expiresAt: { gt: new Date() } } }) : null;
    if (existing) { await this.db.widgetSession.update({ where: { id: existing.id }, data: { lastSeenAt: new Date() } }); return { sessionId: rawToken, expiresAt: existing.expiresAt, config: this.safeConfig(configuration) }; }
    const session = await this.db.widgetSession.create({ data: { widgetConfigurationId: configuration.id, workspaceId: configuration.workspaceId, tokenHash: hash(rawToken), expiresAt: new Date(Date.now() + sessionLifetimeMs), pageUrl: dto.pageUrl, referrer: dto.referrer } });
    return { sessionId: rawToken, expiresAt: session.expiresAt, config: this.safeConfig(configuration) };
  }

  private async session(publicId: string, token: string, request: OriginRequest) {
    const configuration = await this.publicConfiguration(publicId, request);
    const session = await this.db.widgetSession.findFirst({ where: { tokenHash: hash(token), widgetConfigurationId: configuration.id, expiresAt: { gt: new Date() } } });
    if (!session) throw new UnauthorizedException('Widget session expired');
    if (session.messageCount >= maxMessagesPerSession) throw new HttpException('This visitor session has reached its message limit', HttpStatus.TOO_MANY_REQUESTS);
    return { configuration, session };
  }

  async createConversation(publicId: string, dto: WidgetConversationDto, request: OriginRequest) {
    const { configuration, session } = await this.session(publicId, dto.sessionId, request);
    const conversation = await this.db.widgetConversation.create({ data: { widgetConfigurationId: configuration.id, workspaceId: configuration.workspaceId, sessionId: session.id, agentId: configuration.selectedAgent.id, agentNameSnapshot: configuration.selectedAgent.name, title: dto.title.trim() || 'New visitor conversation', visitorPageUrl: session.pageUrl, visitorReferrer: session.referrer } });
    return { id: conversation.id, greeting: configuration.selectedAgent.greeting ?? configuration.greeting, agent: { name: configuration.selectedAgent.name } };
  }

  async listMessages(publicId: string, conversationId: string, sessionId: string, request: OriginRequest) {
    const { configuration, session } = await this.session(publicId, sessionId, request);
    const conversation = await this.db.widgetConversation.findFirst({ where: { id: conversationId, sessionId: session.id, widgetConfigurationId: configuration.id }, include: { messages: { where: { status: { in: ['COMPLETE', 'FAILED', 'CANCELLED'] }, }, orderBy: { createdAt: 'asc' }, include: { sources: { orderBy: { sourceNumber: 'asc' } } } } } });
    if (!conversation) throw new NotFoundException('Conversation not found');
    return { status: conversation.status, mode: conversation.mode, messages: conversation.messages.map((message) => ({ id: message.id, role: message.role, content: message.content, status: message.status, createdAt: message.createdAt, sources: message.sources.map((source) => ({ number: source.sourceNumber, documentName: source.documentNameSnapshot, contentPreview: source.contentPreview, cited: source.cited })) })) };
  }

  async *streamMessage(publicId: string, conversationId: string, dto: WidgetMessageDto, request: OriginRequest): AsyncIterable<Record<string, unknown>> {
    const { configuration, session } = await this.session(publicId, dto.sessionId, request);
    const content = dto.content.trim();
    if (!content) throw new BadRequestException('Message cannot be empty');
    this.assertRateLimit(`${publicId}:message:${this.clientKey(request)}`, 12, 60_000);
    const conversation = await this.db.widgetConversation.findFirst({ where: { id: conversationId, sessionId: session.id, widgetConfigurationId: configuration.id }, include: { agent: { include: agentDocumentSelection } } });
    if (!conversation) throw new NotFoundException('Conversation not found');
    if (conversation.status === 'RESOLVED') { yield { type: 'conversation.resolved', message: 'This conversation has been resolved. Please start a new conversation if you need more help.' }; return; }
    const created = await this.db.$transaction(async (tx) => {
      const user = await tx.widgetMessage.create({ data: { conversationId, workspaceId: configuration.workspaceId, role: 'USER', content, status: 'COMPLETE' } });
      await tx.widgetConversation.update({ where: { id_workspaceId: { id: conversationId, workspaceId: configuration.workspaceId } }, data: { lastMessageAt: new Date() } });
      const assistant = conversation.mode === 'AI' ? await tx.widgetMessage.create({ data: { conversationId, workspaceId: configuration.workspaceId, role: 'ASSISTANT', content: '', status: 'PENDING' } }) : null;
      await tx.widgetSession.update({ where: { id: session.id }, data: { messageCount: { increment: 1 }, lastSeenAt: new Date() } });
      return { user, assistant };
    });
    if (!created.assistant) { yield { type: 'message.completed', messageId: created.user.id, mode: 'HUMAN' }; return; }
    yield { type: 'message.started', messageId: created.assistant.id };
    try {
      const prepared = await this.grounded.preparePublic(configuration.workspaceId, content, { instructions: conversation.agent.instructions, fallbackMessage: conversation.agent.fallbackMessage, model: conversation.agent.model, temperature: conversation.agent.temperature, topP: conversation.agent.topP, maxOutputTokens: conversation.agent.maxOutputTokens, documentIds: conversation.agent.knowledgeDocuments?.map((item) => item.knowledgeDocumentId) ?? [], requireCitations: conversation.agent.requireCitations, groundedOnly: conversation.agent.groundedOnly, allowGeneralKnowledge: conversation.agent.allowGeneralKnowledge });
      if (prepared.insufficient) {
        const fallback = conversation.agent.fallbackMessage ?? 'I couldn’t find enough information in the workspace knowledge base to answer that.';
        await this.complete(created.assistant.id, configuration.workspaceId, fallback, null, prepared, []);
        yield { type: 'message.delta', delta: fallback }; yield { type: 'sources', sources: [] }; yield { type: 'message.completed', messageId: created.assistant.id }; return;
      }
      await this.db.widgetMessage.update({ where: { id: created.assistant.id }, data: { status: 'STREAMING' } });
      const deltas: string[] = []; let usage = { inputTokens: 0, outputTokens: 0 };
      for await (const event of this.grounded.streamPrepared({ question: prepared.question, context: prepared.context, instructions: prepared.instructions, maximumOutputTokens: prepared.maximumOutputTokens, model: prepared.model, temperature: prepared.temperature, topP: prepared.topP })) { if (event.type === 'response.delta') { deltas.push(event.delta); yield { type: 'message.delta', delta: event.delta }; } if (event.type === 'response.completed') usage = event.usage; if (event.type === 'response.failed') throw new Error('generation_failed'); }
      const answer = deltas.join('').trim(); const sources = this.grounded.sourcesFor(prepared, Array.from(answer.matchAll(/\[(\d+)\]/g), (match) => Number(match[1])));
      await this.complete(created.assistant.id, configuration.workspaceId, answer, this.grounded.providerMetadata().provider, prepared, sources, usage);
      yield { type: 'sources', sources: sources.map((source) => ({ number: source.number, documentName: source.documentName, contentPreview: source.contentPreview, cited: source.cited })) }; yield { type: 'message.completed', messageId: created.assistant.id };
    } catch (error) { await this.db.widgetMessage.update({ where: { id: created.assistant.id }, data: { status: 'FAILED', errorCode: error instanceof Error && error.name === 'AbortError' ? 'CANCELLED' : 'GENERATION_FAILED' } }).catch(() => undefined); yield { type: 'message.failed', error: { code: 'GENERATION_FAILED', message: 'The support assistant could not complete this response.' } }; }
  }

  private async complete(messageId: string, workspaceId: string, content: string, provider: string | null, prepared: PreparedGroundedAnswer, sources: Array<{ number: number; documentId: string; chunkId: string; documentName: string; chunkIndex: number; contentPreview: string; similarityScore: number; cited: boolean }>, usage = { inputTokens: 0, outputTokens: 0 }): Promise<void> {
    await this.db.$transaction(async (tx) => { await tx.widgetMessage.update({ where: { id: messageId }, data: { content, status: 'COMPLETE', provider, model: prepared.model, inputTokens: usage.inputTokens, outputTokens: usage.outputTokens } }); await tx.widgetConversation.update({ where: { id_workspaceId: { id: (await tx.widgetMessage.findUniqueOrThrow({ where: { id: messageId }, select: { conversationId: true } })).conversationId, workspaceId } }, data: { lastMessageAt: new Date() } }); if (sources.length) await tx.widgetMessageSource.createMany({ data: sources.map((source) => ({ messageId, workspaceId, documentId: source.documentId, chunkId: source.chunkId, sourceNumber: source.number, documentNameSnapshot: source.documentName, chunkIndexSnapshot: source.chunkIndex, contentPreview: preview(source.contentPreview), similarityScore: source.similarityScore, cited: source.cited })) }); });
  }
}
