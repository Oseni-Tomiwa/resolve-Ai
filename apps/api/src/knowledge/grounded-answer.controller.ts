import { Body, Controller, Param, Post, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
// Nest dependency injection needs this constructor at runtime.
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { GroundedAnswerService } from './grounded-answer.service';
import type { GroundedAnswerDto } from './grounded-answer.dto';

type RequestWithUser = { user: { sub: string } };

@Controller('workspaces/:workspaceId/knowledge')
@UseGuards(JwtAuthGuard)
export class GroundedAnswerController {
  constructor(private readonly service: GroundedAnswerService) {}
  @Post('answer') answer(@Req() request: RequestWithUser, @Param('workspaceId') workspaceId: string, @Body() dto: GroundedAnswerDto) { return this.service.answer(request.user.sub, workspaceId, dto).then((data) => ({ success: true, message: 'Grounded answer generated', data })); }
}
