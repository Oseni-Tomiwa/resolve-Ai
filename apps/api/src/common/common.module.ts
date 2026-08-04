import { Global, Module } from '@nestjs/common';
import { RateLimitService } from './rate-limit.service';
import { MetricsService } from './metrics.service';
import { MonitoringService } from './monitoring.service';

@Global()
@Module({ providers: [RateLimitService, MetricsService, MonitoringService], exports: [RateLimitService, MetricsService, MonitoringService] })
export class CommonModule {}
