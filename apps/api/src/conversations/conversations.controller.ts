import { Body, Controller, Delete, Get, HttpException, Param, Patch, Post, Query, Req, Res, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
// Nest dependency injection and validation need these constructors at runtime.
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { ConversationsService } from './conversations.service';
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { ConversationDetailQueryDto, ConversationListQueryDto, CreateConversationDto, StreamMessageDto, UpdateConversationDto } from './dto';

type RequestWithUser = { user: { sub: string } };

@Controller('workspaces/:workspaceId/ai/conversations')
@UseGuards(JwtAuthGuard)
export class ConversationsController {
  constructor(private readonly service: ConversationsService) {}

  @Post() create(@Req() request: RequestWithUser, @Param('workspaceId') workspaceId: string, @Body() dto: CreateConversationDto) { return this.service.create(request.user.sub, workspaceId, dto).then((data) => ({ success: true, message: 'Conversation created', data })); }
  @Get() list(@Req() request: RequestWithUser, @Param('workspaceId') workspaceId: string, @Query() query: ConversationListQueryDto) { return this.service.list(request.user.sub, workspaceId, query).then((data) => ({ success: true, message: 'Conversations loaded', data })); }
  @Get(':conversationId') detail(@Req() request: RequestWithUser, @Param('workspaceId') workspaceId: string, @Param('conversationId') conversationId: string, @Query() query: ConversationDetailQueryDto) { return this.service.detail(request.user.sub, workspaceId, conversationId, query).then((data) => ({ success: true, message: 'Conversation loaded', data })); }
  @Patch(':conversationId') rename(@Req() request: RequestWithUser, @Param('workspaceId') workspaceId: string, @Param('conversationId') conversationId: string, @Body() dto: UpdateConversationDto) { return this.service.rename(request.user.sub, workspaceId, conversationId, dto).then((data) => ({ success: true, message: 'Conversation renamed', data })); }
  @Delete(':conversationId') remove(@Req() request: RequestWithUser, @Param('workspaceId') workspaceId: string, @Param('conversationId') conversationId: string) { return this.service.remove(request.user.sub, workspaceId, conversationId).then(() => ({ success: true, message: 'Conversation deleted', data: null })); }

  @Post(':conversationId/messages/stream')
  async stream(@Req() request: RequestWithUser, @Param('workspaceId') workspaceId: string, @Param('conversationId') conversationId: string, @Body() dto: StreamMessageDto, @Res() response: Response): Promise<void> {
    response.status(200).set({ 'Content-Type': 'application/x-ndjson; charset=utf-8', 'Cache-Control': 'no-cache, no-transform', Connection: 'keep-alive', 'X-Accel-Buffering': 'no' });
    const abort = new AbortController();
    response.once('close', () => abort.abort());
    try {
      for await (const event of this.service.stream(request.user.sub, workspaceId, conversationId, dto, abort.signal)) {
        if (response.writableEnded) break;
        response.write(`${JSON.stringify(event)}\n`);
      }
    } catch (error) {
      if (!response.writableEnded) {
        const message = error instanceof HttpException ? error.message : 'ResolveAI could not start this response.';
        response.write(`${JSON.stringify({ type: 'message.failed', error: { code: 'REQUEST_FAILED', message } })}\n`);
      }
    }
    if (!response.writableEnded) response.end();
  }
}
