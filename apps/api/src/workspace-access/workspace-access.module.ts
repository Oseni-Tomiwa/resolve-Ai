import { Module } from '@nestjs/common';
import { EmailService } from './email.service';
import { WorkspaceAccessController } from './workspace-access.controller';
import { WorkspaceAccessService } from './workspace-access.service';
@Module({ controllers: [WorkspaceAccessController], providers: [EmailService, WorkspaceAccessService], exports: [WorkspaceAccessService] }) export class WorkspaceAccessModule {}
