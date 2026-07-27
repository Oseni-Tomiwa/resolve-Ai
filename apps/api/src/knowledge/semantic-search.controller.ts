import { Body, Controller, Param, Post, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
// Nest dependency injection needs this constructor at runtime.
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { SemanticSearchService } from './semantic-search.service';
import type { SemanticSearchDto } from './semantic-search.dto';

type RequestWithUser = { user: { sub: string } };

@Controller('workspaces/:workspaceId/knowledge')
@UseGuards(JwtAuthGuard)
export class SemanticSearchController {
  constructor(private readonly service: SemanticSearchService) {}
  @Post('search') search(@Req() request: RequestWithUser, @Param('workspaceId') workspaceId: string, @Body() dto: SemanticSearchDto) { return this.service.search(request.user.sub, workspaceId, dto).then((data) => ({ success: true, message: 'Knowledge search completed', data })); }
}
