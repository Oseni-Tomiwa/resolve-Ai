import { Module } from '@nestjs/common';
import { KnowledgeModule } from '../knowledge/knowledge.module';
import { AgentsModule } from '../agents/agents.module';
import { WorkspaceAccessModule } from '../workspace-access/workspace-access.module';
import { ConversationsController } from './conversations.controller';
import { ConversationsService } from './conversations.service';
import { BillingModule } from '../billing/billing.module';

@Module({ imports: [KnowledgeModule, WorkspaceAccessModule, AgentsModule, BillingModule], controllers: [ConversationsController], providers: [ConversationsService] })
export class ConversationsModule {}
