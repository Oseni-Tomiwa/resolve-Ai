import { Module } from '@nestjs/common';
import { WorkspaceAccessModule } from '../workspace-access/workspace-access.module';
import { InboxController } from './inbox.controller';
import { InboxService } from './inbox.service';
@Module({ imports: [WorkspaceAccessModule], controllers: [InboxController], providers: [InboxService] })
export class InboxModule {}
