import { Body, Controller, Get, Param, Post, Put, Query, Req, Res, UseGuards } from '@nestjs/common';
import type { Request, Response } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
// Nest dependency injection needs the service constructor at runtime.
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { WidgetService } from './widget.service';
// Nest validation needs DTO constructors at runtime.
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { UpdateWidgetConfigurationDto, WidgetConversationDto, WidgetMessageDto, WidgetSessionDto } from './widget.dto';

type AuthRequest = Request & { user: { sub: string } };

@Controller('workspaces/:workspaceId/widget')
@UseGuards(JwtAuthGuard)
export class WidgetController {
  constructor(private readonly service: WidgetService) {}
  @Get() get(@Req() request: AuthRequest, @Param('workspaceId') workspaceId: string) { return this.service.getAdmin(request.user.sub, workspaceId).then((data) => ({ success: true, message: 'Widget configuration loaded', data })); }
  @Put('configuration') update(@Req() request: AuthRequest, @Param('workspaceId') workspaceId: string, @Body() dto: UpdateWidgetConfigurationDto) { return this.service.updateAdmin(request.user.sub, workspaceId, dto).then((data) => ({ success: true, message: 'Widget configuration saved', data })); }
  @Post('regenerate') regenerate(@Req() request: AuthRequest, @Param('workspaceId') workspaceId: string) { return this.service.regenerate(request.user.sub, workspaceId).then((data) => ({ success: true, message: 'Widget public identifier regenerated', data })); }
}

@Controller('public/widgets')
export class PublicWidgetController {
  constructor(private readonly service: WidgetService) {}
  private origin(request: Request): string | undefined { return request.headers.origin; }
  private cors(response: Response, request: Request): void { const origin = this.origin(request); if (origin) { response.setHeader('Access-Control-Allow-Origin', origin); response.setHeader('Vary', 'Origin'); } response.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS'); response.setHeader('Access-Control-Allow-Headers', 'Content-Type'); }
  @Get(':publicId/config') async config(@Param('publicId') publicId: string, @Req() request: Request, @Res({ passthrough: true }) response: Response) { this.cors(response, request); const data = await this.service.publicConfig(publicId, request); return { success: true, message: 'Widget configuration loaded', data }; }
  @Post(':publicId/sessions') async session(@Param('publicId') publicId: string, @Body() dto: WidgetSessionDto, @Req() request: Request, @Res({ passthrough: true }) response: Response) { this.cors(response, request); const data = await this.service.createSession(publicId, dto, request); return { success: true, message: 'Widget session ready', data }; }
  @Post(':publicId/conversations') async conversation(@Param('publicId') publicId: string, @Body() dto: WidgetConversationDto, @Req() request: Request, @Res({ passthrough: true }) response: Response) { this.cors(response, request); const data = await this.service.createConversation(publicId, dto, request); return { success: true, message: 'Widget conversation created', data }; }
  @Post(':publicId/conversations/:conversationId/request-human') async requestHuman(@Param('publicId') publicId: string, @Param('conversationId') conversationId: string, @Body() dto: WidgetSessionDto, @Req() request: Request, @Res({ passthrough: true }) response: Response) { this.cors(response, request); const data = await this.service.requestHuman(publicId, conversationId, dto.sessionId ?? '', request); return { success: true, message: 'Human handoff requested', data }; }
  @Get(':publicId/conversations/:conversationId/messages') async messages(@Param('publicId') publicId: string, @Param('conversationId') conversationId: string, @Query('sessionId') sessionId: string, @Req() request: Request, @Res({ passthrough: true }) response: Response) { this.cors(response, request); const data = await this.service.listMessages(publicId, conversationId, sessionId, request); return { success: true, message: 'Widget messages loaded', data }; }
  @Post(':publicId/conversations/:conversationId/messages/stream') async stream(@Param('publicId') publicId: string, @Param('conversationId') conversationId: string, @Body() dto: WidgetMessageDto, @Req() request: Request, @Res() response: Response): Promise<void> { this.cors(response, request); response.status(200).set({ 'Content-Type': 'application/x-ndjson; charset=utf-8', 'Cache-Control': 'no-cache, no-transform', Connection: 'keep-alive', 'X-Accel-Buffering': 'no' }); const abort = new AbortController(); response.once('close', () => abort.abort()); try { for await (const event of this.service.streamMessage(publicId, conversationId, dto, request)) { if (response.writableEnded) break; response.write(`${JSON.stringify(event)}\n`); } } catch { if (!response.writableEnded) response.write(`${JSON.stringify({ type: 'message.failed', error: { code: 'REQUEST_FAILED', message: 'The support assistant could not start this response.' } })}\n`); } if (!response.writableEnded) response.end(); }
}
