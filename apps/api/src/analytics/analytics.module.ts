import { Module } from '@nestjs/common';
import { WorkspaceAccessModule } from '../workspace-access/workspace-access.module';
import { AnalyticsController } from './analytics.controller';
import { AnalyticsService } from './analytics.service';

@Module({ imports: [WorkspaceAccessModule], controllers: [AnalyticsController], providers: [AnalyticsService] })
export class AnalyticsModule {}
