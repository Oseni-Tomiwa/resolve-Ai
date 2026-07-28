import { ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import type { PrismaClient } from '@resolveai/database';
// Nest dependency injection needs this service constructor at runtime.
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { WorkspaceAccessService } from '../workspace-access/workspace-access.service';
import type { ChangeBillingPlanDto } from './billing.dto';
import { BILLING_PROVIDER, type BillingProvider } from './billing.provider';
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
    const result = await this.provider.changePlan({ workspaceId, plan: dto.plan, currentProviderSubscriptionId: subscription.providerSubscriptionId });
    return this.db.workspaceSubscription.update({ where: { workspaceId }, data: { plan: result.plan, status: 'ACTIVE', provider: result.provider, providerSubscriptionId: result.providerSubscriptionId, renewalDate: subscription.currentPeriodEnd }, });
  }
}
