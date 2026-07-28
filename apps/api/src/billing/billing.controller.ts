import { Body, Controller, Get, Param, Patch, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
// Nest validation needs this DTO constructor at runtime.
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { ChangeBillingPlanDto } from './billing.dto';
// Nest dependency injection needs this service constructor at runtime.
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { BillingService } from './billing.service';

type RequestWithUser = { user: { sub: string } };

@Controller('workspaces/:workspaceId/billing')
@UseGuards(JwtAuthGuard)
export class BillingController {
  constructor(private readonly service: BillingService) {}

  @Get()
  get(@Req() request: RequestWithUser, @Param('workspaceId') workspaceId: string) { return this.service.get(request.user.sub, workspaceId).then((data) => ({ success: true, message: 'Billing loaded', data })); }

  @Patch('plan')
  changePlan(@Req() request: RequestWithUser, @Param('workspaceId') workspaceId: string, @Body() dto: ChangeBillingPlanDto) { return this.service.changePlan(request.user.sub, workspaceId, dto).then((data) => ({ success: true, message: 'Plan updated', data })); }
}
