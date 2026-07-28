import { Injectable } from '@nestjs/common';
import type { BillingPlanDto } from './billing.dto';

export const BILLING_PROVIDER = 'BILLING_PROVIDER';

export type BillingPlan = BillingPlanDto;
export type PlanChangeResult = { provider: string; providerSubscriptionId: string; plan: BillingPlan };

export interface BillingProvider {
  changePlan(input: { workspaceId: string; plan: BillingPlan; currentProviderSubscriptionId?: string | null }): Promise<PlanChangeResult>;
}

@Injectable()
export class MockBillingProvider implements BillingProvider {
  async changePlan(input: { workspaceId: string; plan: BillingPlan; currentProviderSubscriptionId?: string | null }): Promise<PlanChangeResult> {
    return { provider: 'mock', providerSubscriptionId: input.currentProviderSubscriptionId ?? `mock_sub_${input.workspaceId}`, plan: input.plan };
  }
}
