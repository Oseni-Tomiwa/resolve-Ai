import { Module } from '@nestjs/common';
import { KnowledgeModule } from '../knowledge/knowledge.module';
import { AgentsModule } from '../agents/agents.module';
import { WorkspaceAccessModule } from '../workspace-access/workspace-access.module';
import { ConversationsController } from './conversations.controller';
import { ConversationsService } from './conversations.service';

@Module({ imports: [KnowledgeModule, WorkspaceAccessModule, AgentsModule], controllers: [ConversationsController], providers: [ConversationsService] })
export class ConversationsModule {}
