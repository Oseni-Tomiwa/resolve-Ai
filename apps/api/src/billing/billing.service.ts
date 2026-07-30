import { ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import type { PrismaClient, SubscriptionPlan } from '@resolveai/database';
// Nest dependency injection needs this service constructor at runtime.
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { WorkspaceAccessService } from '../workspace-access/workspace-access.service';
import type { BillingCheckoutDto, BillingPlanDto, ChangeBillingPlanDto } from './billing.dto';
import { BILLING_PROVIDER, type BillingProvider, type PlanChangeResult, type StripeWebhookEvent } from './billing.provider';
// Nest dependency injection needs this service constructor at runtime.
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { BillingUsageService } from './billing-usage.service';

@Injectable()
export class BillingService {
  constructor(@Inject('PRISMA') private readonly db: PrismaClient, private readonly access: WorkspaceAccessService, private readonly usageService: BillingUsageService, @Inject(BILLING_PROVIDER) private readonly provider: BillingProvider) {}

  private async billingAccess(userId: string, workspaceId: string) {
    const access = await this.access.getAccess(userId, workspaceId);
    if (!['OWNER', 'ADMIN'].includes(access.organizationRole)) throw new ForbiddenException('Only organization owners and admins can manage billing');
    return access;
  }

  private async billingViewAccess(userId: string, workspaceId: string) {
    const access = await this.access.getAccess(userId, workspaceId);
    if (!['OWNER', 'ADMIN'].includes(access.organizationRole) && access.workspaceRole !== 'ADMIN') throw new ForbiddenException('Billing access is restricted to workspace administrators');
    return access;
  }

  async get(userId: string, workspaceId: string) {
    await this.billingViewAccess(userId, workspaceId);
    const subscription = await this.usageService.ensureSubscription(workspaceId);
    if (!subscription) throw new NotFoundException('Workspace subscription not found');
    const usage = await this.usageService.usage(workspaceId);
    return { subscription, usage };
  }

  async changePlan(userId: string, workspaceId: string, dto: ChangeBillingPlanDto) {
    await this.billingAccess(userId, workspaceId);
    const subscription = await this.usageService.ensureSubscription(workspaceId);
    if (dto.plan === 'FREE' && subscription.providerSubscriptionId && this.provider.cancelSubscription) {
      const canceled = await this.provider.cancelSubscription({ providerSubscriptionId: subscription.providerSubscriptionId });
      return this.persistProviderResult(workspaceId, canceled, subscription.currentPeriodEnd);
    }
    const result = await this.provider.changePlan({ workspaceId, plan: dto.plan, currentProviderCustomerId: subscription.providerCustomerId, currentProviderSubscriptionId: subscription.providerSubscriptionId });
    if (result.checkoutUrl) {
      return this.db.workspaceSubscription.update({ where: { workspaceId }, data: { provider: result.provider, providerCustomerId: result.providerCustomerId ?? subscription.providerCustomerId } }).then((updated) => ({ ...updated, checkoutUrl: result.checkoutUrl }));
    }
    return this.persistProviderResult(workspaceId, result, subscription.currentPeriodEnd);
  }

  async checkout(userId: string, workspaceId: string, dto: BillingCheckoutDto) {
    await this.billingAccess(userId, workspaceId);
    const subscription = await this.usageService.ensureSubscription(workspaceId);
    const result = await this.provider.createCheckoutSession({ workspaceId, plan: dto.plan, providerCustomerId: subscription.providerCustomerId });
    await this.db.workspaceSubscription.update({ where: { workspaceId }, data: { provider: result.provider, providerCustomerId: result.providerCustomerId } });
    return result;
  }

  async portal(userId: string, workspaceId: string) {
    await this.billingAccess(userId, workspaceId);
    const subscription = await this.usageService.ensureSubscription(workspaceId);
    if (!subscription.providerCustomerId) throw new NotFoundException('No Stripe billing customer exists for this workspace');
    return this.provider.createPortalSession({ providerCustomerId: subscription.providerCustomerId });
  }

  async handleWebhook(event: StripeWebhookEvent) {
    const object = event.data.object;
    const metadata = object.metadata && typeof object.metadata === 'object' ? object.metadata as Record<string, unknown> : {};
    const customerId = typeof object.customer === 'string' ? object.customer : undefined;
    const subscriptionId = typeof object.subscription === 'string' ? object.subscription : typeof object.id === 'string' && event.type.startsWith('customer.subscription.') ? object.id : undefined;
    const lookup = [customerId ? { providerCustomerId: customerId } : null, subscriptionId ? { providerSubscriptionId: subscriptionId } : null].filter((value): value is { providerCustomerId: string } | { providerSubscriptionId: string } => value !== null);
    const existing = lookup.length > 0 ? await this.db.workspaceSubscription.findFirst({ where: { OR: lookup } }) : null;
    const workspaceId = typeof metadata.workspaceId === 'string' ? metadata.workspaceId : existing?.workspaceId;
    if (!workspaceId) return { handled: false, reason: 'workspace_not_found' };
    if (event.type === 'checkout.session.completed' || event.type.startsWith('customer.subscription.')) {
      if (!this.provider.subscriptionResult) return { handled: false, reason: 'provider_cannot_sync' };
      const metadataPlan = typeof metadata.plan === 'string' && ['FREE', 'STARTER', 'PRO', 'BUSINESS', 'ENTERPRISE'].includes(metadata.plan) ? metadata.plan as BillingPlanDto : undefined;
      const result = this.provider.subscriptionResult(object, metadataPlan, customerId);
      await this.persistProviderResult(workspaceId, result, existing?.currentPeriodEnd ?? new Date());
      return { handled: true };
    }
    if (event.type === 'invoice.payment_failed') {
      await this.db.workspaceSubscription.updateMany({ where: { workspaceId, provider: 'stripe' }, data: { status: 'PAST_DUE' } });
      return { handled: true };
    }
    return { handled: false, reason: 'event_ignored' };
  }

  private async persistProviderResult(workspaceId: string, result: PlanChangeResult, fallbackPeriodEnd: Date) {
    return this.db.workspaceSubscription.update({ where: { workspaceId }, data: { plan: result.plan as SubscriptionPlan, status: result.status ?? 'ACTIVE', provider: result.provider, providerCustomerId: result.providerCustomerId, providerSubscriptionId: result.providerSubscriptionId, currentPeriodStart: result.currentPeriodStart, currentPeriodEnd: result.currentPeriodEnd ?? fallbackPeriodEnd, renewalDate: result.renewalDate ?? result.currentPeriodEnd ?? fallbackPeriodEnd } });
  }
}
