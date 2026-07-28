import { Controller, Get, Param, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
// Nest dependency injection needs this service constructor at runtime.
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { AnalyticsService } from './analytics.service';

type RequestWithUser = { user: { sub: string } };

@Controller('workspaces/:workspaceId/analytics')
@UseGuards(JwtAuthGuard)
export class AnalyticsController {
  constructor(private readonly service: AnalyticsService) {}

  @Get()
  get(@Req() request: RequestWithUser, @Param('workspaceId') workspaceId: string) { return this.service.get(request.user.sub, workspaceId).then((data) => ({ success: true, message: 'Analytics loaded', data })); }
}
