import { Module } from '@nestjs/common';
import { WorkspaceAccessModule } from '../workspace-access/workspace-access.module';
import { BillingController } from './billing.controller';
import { BILLING_PROVIDER, MockBillingProvider } from './billing.provider';
import { BillingService } from './billing.service';
import { BillingUsageService } from './billing-usage.service';

@Module({ imports: [WorkspaceAccessModule], controllers: [BillingController], providers: [BillingUsageService, BillingService, MockBillingProvider, { provide: BILLING_PROVIDER, useExisting: MockBillingProvider }], exports: [BillingUsageService] })
export class BillingModule {}
