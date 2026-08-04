import { Body, Controller, HttpException, HttpStatus, Optional, Param, Post, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
// Nest dependency injection and validation need these constructors at runtime.
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { SemanticSearchService } from './semantic-search.service';
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { SemanticSearchDto } from './semantic-search.dto';
// Nest dependency injection needs this constructor at runtime.
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { RateLimitService } from '../common/rate-limit.service';

type RequestWithUser = { user: { sub: string }; ip?: string };

@Controller('workspaces/:workspaceId/knowledge')
@UseGuards(JwtAuthGuard)
export class SemanticSearchController {
  constructor(private readonly service: SemanticSearchService, @Optional() private readonly rateLimit?: RateLimitService) {}
  private protect(request: RequestWithUser): void { if (this.rateLimit && !this.rateLimit.allow('semantic-search:' + (request.ip ?? 'unknown'), Number(process.env.PUBLIC_RATE_LIMIT_MAX ?? 60), Number(process.env.PUBLIC_RATE_LIMIT_WINDOW_MS ?? 60000))) throw new HttpException({ code: 'RATE_LIMITED', message: 'Please try again shortly.' }, HttpStatus.TOO_MANY_REQUESTS); }
  @Post('search') search(@Req() request: RequestWithUser, @Param('workspaceId') workspaceId: string, @Body() dto: SemanticSearchDto) { this.protect(request); return this.service.search(request.user.sub, workspaceId, dto).then((data) => ({ success: true, message: 'Knowledge search completed', data })); }
}
