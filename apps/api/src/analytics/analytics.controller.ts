import { Controller, Get, Param, Query, Req, UseGuards } from '@nestjs/common';
import { ApiKeyScopeGuard, JwtOrApiKeyGuard, RequireApiKeyScope } from '../api-keys/api-key-access';
// Nest dependency injection needs this service constructor at runtime.
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { AnalyticsService } from './analytics.service';
// Nest validation needs the DTO constructor at runtime.
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { AnalyticsQueryDto } from './analytics.dto';

type RequestWithUser = { user: { sub: string } };

@Controller('workspaces/:workspaceId/analytics')
@UseGuards(JwtOrApiKeyGuard, ApiKeyScopeGuard)
@RequireApiKeyScope('analytics:read')
export class AnalyticsController {
  constructor(private readonly service: AnalyticsService) {}
  @Get()
  get(@Req() request: RequestWithUser, @Param('workspaceId') workspaceId: string, @Query() query: AnalyticsQueryDto) { return this.service.get(request.user.sub, workspaceId, query).then((data) => ({ success: true, message: 'Analytics loaded', data })); }
}
