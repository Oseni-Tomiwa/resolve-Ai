import { Module } from '@nestjs/common';
import { AuthModule } from './auth/auth.module';
import { DatabaseModule } from './database/database.module';
import { HealthModule } from './health/health.module';
import { OrganizationsModule } from './organizations/organizations.module';
import { UsersModule } from './users/users.module';
import { WorkspacesModule } from './workspaces/workspaces.module';
import { OnboardingModule } from './onboarding/onboarding.module';
import { WorkspaceAccessModule } from './workspace-access/workspace-access.module';
import { KnowledgeModule } from './knowledge/knowledge.module';
import { ConversationsModule } from './conversations/conversations.module';
import { AgentsModule } from './agents/agents.module';
import { WidgetModule } from './widget/widget.module';
import { InboxModule } from './inbox/inbox.module';
@Module({ imports: [DatabaseModule, HealthModule, AuthModule, UsersModule, OrganizationsModule, WorkspacesModule, OnboardingModule, WorkspaceAccessModule, KnowledgeModule, AgentsModule, ConversationsModule, WidgetModule, InboxModule] })
export class AppModule {}
