import { Module } from '@nestjs/common';
import { WorkspaceAccessModule } from '../workspace-access/workspace-access.module';
import { BillingController } from './billing.controller';
import { BILLING_PROVIDER, MockBillingProvider, StripeBillingProvider, STRIPE_OPTIONS, type BillingProvider, type StripeBillingOptions } from './billing.provider';
import { BillingService } from './billing.service';
import { BillingUsageService } from './billing-usage.service';
import { BillingWebhookController } from './billing-webhook.controller';

const stripeOptions = (): StripeBillingOptions => ({
  secretKey: process.env.STRIPE_SECRET_KEY,
  webhookSecret: process.env.STRIPE_WEBHOOK_SECRET,
  priceIds: { PRO: process.env.STRIPE_PRICE_PRO, BUSINESS: process.env.STRIPE_PRICE_BUSINESS },
  successUrl: process.env.STRIPE_SUCCESS_URL ?? `${process.env.WEB_URL ?? 'http://localhost:3000'}/dashboard/billing?checkout=success`,
  cancelUrl: process.env.STRIPE_CANCEL_URL ?? `${process.env.WEB_URL ?? 'http://localhost:3000'}/dashboard/billing?checkout=cancelled`,
  portalReturnUrl: process.env.STRIPE_PORTAL_RETURN_URL ?? `${process.env.WEB_URL ?? 'http://localhost:3000'}/dashboard/billing`,
  webhookToleranceSeconds: Number(process.env.STRIPE_WEBHOOK_TOLERANCE_SECONDS ?? 300),
});

@Module({ imports: [WorkspaceAccessModule], controllers: [BillingController, BillingWebhookController], providers: [BillingUsageService, BillingService, { provide: STRIPE_OPTIONS, useFactory: stripeOptions }, StripeBillingProvider, MockBillingProvider, { provide: BILLING_PROVIDER, useFactory: (stripe: StripeBillingProvider, mock: MockBillingProvider): BillingProvider => process.env.BILLING_PROVIDER === 'stripe' ? stripe : mock, inject: [StripeBillingProvider, MockBillingProvider] }], exports: [BillingUsageService] })
export class BillingModule {}
