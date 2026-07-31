import { BadRequestException, Inject, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { BillingPlanDto } from './billing.dto';

export const BILLING_PROVIDER = 'BILLING_PROVIDER';
export const STRIPE_OPTIONS = 'STRIPE_OPTIONS';

export type BillingPlan = BillingPlanDto;
export type PlanChangeResult = {
  provider: string;
  providerCustomerId?: string | null;
  providerSubscriptionId?: string | null;
  plan: BillingPlan;
  status?: 'TRIALING' | 'ACTIVE' | 'PAST_DUE' | 'CANCELED';
  currentPeriodStart?: Date;
  currentPeriodEnd?: Date;
  renewalDate?: Date | null;
  checkoutUrl?: string;
};

export type BillingCheckoutResult = { provider: 'stripe'; sessionId: string; checkoutUrl: string; providerCustomerId: string };
export type BillingPortalResult = { provider: 'stripe'; portalUrl: string };
export type StripeBillingOptions = {
  secretKey?: string;
  webhookSecret?: string;
  priceIds: Partial<Record<Exclude<BillingPlan, 'FREE' | 'STARTER' | 'ENTERPRISE'>, string>>;
  successUrl: string;
  cancelUrl: string;
  portalReturnUrl: string;
  webhookToleranceSeconds: number;
};
export type StripeWebhookEvent = { id: string; type: string; data: { object: Record<string, unknown> } };

export interface BillingProvider {
  changePlan(input: { workspaceId: string; plan: BillingPlan; currentProviderCustomerId?: string | null; currentProviderSubscriptionId?: string | null }): Promise<PlanChangeResult>;
  createCheckoutSession(input: { workspaceId: string; plan: BillingPlan; providerCustomerId?: string | null }): Promise<BillingCheckoutResult>;
  createPortalSession(input: { providerCustomerId: string }): Promise<BillingPortalResult>;
  createCustomer?(workspaceId: string): Promise<string>;
  cancelSubscription?(input: { providerSubscriptionId: string }): Promise<PlanChangeResult>;
  verifyWebhook(rawBody: Buffer, signature: string): StripeWebhookEvent;
  subscriptionResult?(subscription: Record<string, unknown>, fallbackPlan?: BillingPlan, fallbackCustomerId?: string | null): PlanChangeResult;
}

const asString = (value: unknown): string | undefined => typeof value === 'string' && value.length > 0 ? value : undefined;
const asRecord = (value: unknown): Record<string, unknown> => value && typeof value === 'object' ? value as Record<string, unknown> : {};
const asNumber = (value: unknown): number | undefined => typeof value === 'number' ? value : undefined;
const formValue = (value: string | number | boolean): string => String(value);

@Injectable()
export class StripeBillingProvider implements BillingProvider {
  constructor(@Inject(STRIPE_OPTIONS) private readonly options: StripeBillingOptions) {}

  async changePlan(input: { workspaceId: string; plan: BillingPlan; currentProviderCustomerId?: string | null; currentProviderSubscriptionId?: string | null }): Promise<PlanChangeResult> {
    this.requireConfigured();
    if (input.plan === BillingPlanDto.FREE) return { provider: 'stripe', plan: BillingPlanDto.FREE, status: 'ACTIVE', providerCustomerId: input.currentProviderCustomerId, providerSubscriptionId: input.currentProviderSubscriptionId };
    if (!input.currentProviderSubscriptionId) {
      const checkout = await this.createCheckoutSession({ workspaceId: input.workspaceId, plan: input.plan, providerCustomerId: input.currentProviderCustomerId });
      return { provider: 'stripe', plan: input.plan, providerCustomerId: checkout.providerCustomerId, checkoutUrl: checkout.checkoutUrl };
    }
    const price = this.priceFor(input.plan);
    const subscription = await this.request<Record<string, unknown>>(`/subscriptions/${encodeURIComponent(input.currentProviderSubscriptionId)}`, {
      'items[0][price]': price,
      proration_behavior: 'create_prorations',
    }, `change-plan-${input.workspaceId}-${input.plan}`);
    return this.subscriptionResult(subscription, input.plan, input.currentProviderCustomerId);
  }

  async createCheckoutSession(input: { workspaceId: string; plan: BillingPlan; providerCustomerId?: string | null }): Promise<BillingCheckoutResult> {
    this.requireConfigured();
    if (input.plan === BillingPlanDto.FREE) throw new BadRequestException('Free plan does not require checkout');
    const customerId = input.providerCustomerId ?? await this.createCustomer(input.workspaceId);
    const session = await this.request<Record<string, unknown>>('/checkout/sessions', {
      mode: 'subscription',
      customer: customerId,
      'line_items[0][price]': this.priceFor(input.plan),
      'line_items[0][quantity]': 1,
      success_url: this.options.successUrl,
      cancel_url: this.options.cancelUrl,
      'subscription_data[metadata][workspaceId]': input.workspaceId,
      'subscription_data[metadata][plan]': input.plan,
      'metadata[workspaceId]': input.workspaceId,
      'metadata[plan]': input.plan,
    }, `checkout-${input.workspaceId}-${input.plan}`);
    const url = asString(session.url);
    const id = asString(session.id);
    if (!url || !id) throw new ServiceUnavailableException('Stripe did not return a checkout session');
    return { provider: 'stripe', sessionId: id, checkoutUrl: url, providerCustomerId: customerId };
  }

  async createPortalSession(input: { providerCustomerId: string }): Promise<BillingPortalResult> {
    this.requireConfigured();
    const session = await this.request<Record<string, unknown>>('/billing_portal/sessions', { customer: input.providerCustomerId, return_url: this.options.portalReturnUrl }, `portal-${input.providerCustomerId}`);
    const url = asString(session.url);
    if (!url) throw new ServiceUnavailableException('Stripe did not return a customer portal URL');
    return { provider: 'stripe', portalUrl: url };
  }

  async cancelSubscription(input: { providerSubscriptionId: string }): Promise<PlanChangeResult> {
    this.requireConfigured();
    const subscription = await this.request<Record<string, unknown>>(`/subscriptions/${encodeURIComponent(input.providerSubscriptionId)}`, {}, `cancel-${input.providerSubscriptionId}`, 'DELETE');
    return this.subscriptionResult(subscription, BillingPlanDto.FREE);
  }

  verifyWebhook(rawBody: Buffer, signature: string): StripeWebhookEvent {
    if (!this.options.webhookSecret) throw new ServiceUnavailableException('Stripe webhook handling is not configured');
    const parts = new Map(signature.split(',').map((part) => part.split('=').map((value) => value.trim()) as [string, string]));
    const timestamp = parts.get('t');
    const expected = parts.get('v1');
    if (!timestamp || !expected || !/^\d+$/.test(timestamp)) throw new BadRequestException('Invalid Stripe webhook signature');
    if (Math.abs(Date.now() / 1000 - Number(timestamp)) > this.options.webhookToleranceSeconds) throw new BadRequestException('Expired Stripe webhook signature');
    const digest = createHmac('sha256', this.options.webhookSecret).update(`${timestamp}.${rawBody.toString('utf8')}`).digest('hex');
    const expectedBuffer = Buffer.from(expected, 'hex');
    const digestBuffer = Buffer.from(digest, 'hex');
    if (expectedBuffer.length !== digestBuffer.length || !timingSafeEqual(expectedBuffer, digestBuffer)) throw new BadRequestException('Invalid Stripe webhook signature');
    try {
      const parsed = JSON.parse(rawBody.toString('utf8')) as StripeWebhookEvent;
      if (!parsed.id || !parsed.type || !parsed.data?.object) throw new Error('invalid event');
      return parsed;
    } catch {
      throw new BadRequestException('Invalid Stripe webhook payload');
    }
  }

  planForPrice(priceId: string | undefined): BillingPlan | undefined {
    if (priceId && priceId === this.options.priceIds.PRO) return BillingPlanDto.PRO;
    if (priceId && priceId === this.options.priceIds.BUSINESS) return BillingPlanDto.BUSINESS;
    return undefined;
  }

  subscriptionResult(subscription: Record<string, unknown>, fallbackPlan?: BillingPlan, fallbackCustomerId?: string | null): PlanChangeResult {
    const items = asRecord(subscription.items);
    const firstItem = asRecord(Array.isArray(items.data) ? items.data[0] : undefined);
    const price = asRecord(firstItem.price);
    const plan = fallbackPlan ?? this.planForPrice(asString(price.id)) ?? BillingPlanDto.PRO;
    const status = this.statusFor(asString(subscription.status));
    const start = asNumber(subscription.current_period_start);
    const end = asNumber(subscription.current_period_end);
    return { provider: 'stripe', plan, status, providerCustomerId: asString(subscription.customer) ?? fallbackCustomerId, providerSubscriptionId: asString(subscription.subscription) ?? asString(subscription.id), currentPeriodStart: start ? new Date(start * 1000) : undefined, currentPeriodEnd: end ? new Date(end * 1000) : undefined, renewalDate: status === 'CANCELED' ? null : end ? new Date(end * 1000) : undefined };
  }

  private statusFor(status: string | undefined): PlanChangeResult['status'] {
    if (status === 'trialing') return 'TRIALING';
    if (status === 'past_due' || status === 'unpaid' || status === 'incomplete') return 'PAST_DUE';
    if (status === 'canceled' || status === 'incomplete_expired') return 'CANCELED';
    return 'ACTIVE';
  }

  private priceFor(plan: BillingPlan): string {
    const price = this.options.priceIds[plan as 'PRO' | 'BUSINESS'];
    if (!price) throw new ServiceUnavailableException(`Stripe price is not configured for the ${plan.toLowerCase()} plan`);
    return price;
  }

  async createCustomer(workspaceId: string): Promise<string> {
    const customer = await this.request<Record<string, unknown>>('/customers', { 'metadata[workspaceId]': workspaceId }, `customer-${workspaceId}`);
    const id = asString(customer.id);
    if (!id) throw new ServiceUnavailableException('Stripe did not return a customer');
    return id;
  }

  private requireConfigured(): void {
    if (!this.options.secretKey) throw new ServiceUnavailableException('Stripe billing is not configured');
  }

  private async request<T extends Record<string, unknown>>(path: string, values: Record<string, string | number | boolean>, idempotencyKey: string, method: 'POST' | 'DELETE' = 'POST'): Promise<T> {
    this.requireConfigured();
    const form = new URLSearchParams();
    for (const [key, value] of Object.entries(values)) form.set(key, formValue(value));
    const response = await fetch(`https://api.stripe.com/v1${path}`, { method, headers: { Authorization: `Bearer ${this.options.secretKey}`, 'Content-Type': 'application/x-www-form-urlencoded', 'Idempotency-Key': idempotencyKey }, body: method === 'POST' ? form : undefined });
    const payload = await response.json() as T & { error?: { message?: string } };
    if (!response.ok) throw new ServiceUnavailableException('Stripe request failed');
    return payload;
  }
}

/** Test-only provider retained so existing deterministic billing unit tests remain small. */
@Injectable()
export class MockBillingProvider implements BillingProvider {
  async changePlan(input: { workspaceId: string; plan: BillingPlan; currentProviderCustomerId?: string | null; currentProviderSubscriptionId?: string | null }): Promise<PlanChangeResult> { return { provider: 'mock', providerCustomerId: input.currentProviderCustomerId, providerSubscriptionId: input.currentProviderSubscriptionId ?? `mock_sub_${input.workspaceId}`, plan: input.plan, status: 'ACTIVE' }; }
  async createCheckoutSession(): Promise<BillingCheckoutResult> { throw new ServiceUnavailableException('Mock billing does not support checkout'); }
  async createPortalSession(): Promise<BillingPortalResult> { throw new ServiceUnavailableException('Mock billing does not support the customer portal'); }
  async createCustomer(workspaceId: string): Promise<string> { return `mock_customer_${workspaceId}`; }
  async cancelSubscription(): Promise<PlanChangeResult> { throw new ServiceUnavailableException('Mock billing does not support cancellation'); }
  verifyWebhook(): StripeWebhookEvent { throw new ServiceUnavailableException('Mock billing does not support webhooks'); }
  subscriptionResult(_subscription: Record<string, unknown>, fallbackPlan: BillingPlan = BillingPlanDto.FREE, fallbackCustomerId?: string | null): PlanChangeResult { return { provider: 'mock', plan: fallbackPlan, status: 'ACTIVE', providerCustomerId: fallbackCustomerId }; }
}
