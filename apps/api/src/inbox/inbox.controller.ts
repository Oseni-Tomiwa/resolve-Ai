import { Body, Controller, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
// Nest dependency injection needs the service constructor at runtime.
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { InboxService } from './inbox.service';
// Nest validation needs DTO constructors at runtime.
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { InboxAssignmentDto, InboxListDto, InboxMessageDto, InboxNoteDto, InboxPriorityDto, InboxStatusDto } from './inbox.dto';
type AuthRequest = Request & { user: { sub: string } };
@Controller('workspaces/:workspaceId/inbox') @UseGuards(JwtAuthGuard)
export class InboxController {
  constructor(private readonly service: InboxService) {}
  private ok<T>(data: T) { return { success: true, message: 'Inbox request completed', data }; }
  @Get() async list(@Req() r: AuthRequest, @Param('workspaceId') w: string, @Query() q: InboxListDto) { return this.ok(await this.service.list(r.user.sub, w, q)); }
  @Get(':conversationId') async detail(@Req() r: AuthRequest, @Param('workspaceId') w: string, @Param('conversationId') id: string) { return this.ok(await this.service.detail(r.user.sub, w, id)); }
  @Post(':conversationId/read') async read(@Req() r: AuthRequest, @Param('workspaceId') w: string, @Param('conversationId') id: string) { return this.ok(await this.service.markRead(r.user.sub, w, id)); }
  @Patch(':conversationId/assignment') async assign(@Req() r: AuthRequest, @Param('workspaceId') w: string, @Param('conversationId') id: string, @Body() d: InboxAssignmentDto) { return this.ok(await this.service.assign(r.user.sub, w, id, d)); }
  @Patch(':conversationId/priority') async priority(@Req() r: AuthRequest, @Param('workspaceId') w: string, @Param('conversationId') id: string, @Body() d: InboxPriorityDto) { return this.ok(await this.service.priority(r.user.sub, w, id, d)); }
  @Patch(':conversationId/status') async status(@Req() r: AuthRequest, @Param('workspaceId') w: string, @Param('conversationId') id: string, @Body() d: InboxStatusDto) { return this.ok(await this.service.status(r.user.sub, w, id, d)); }
  @Post(':conversationId/takeover') async takeover(@Req() r: AuthRequest, @Param('workspaceId') w: string, @Param('conversationId') id: string) { return this.ok(await this.service.takeover(r.user.sub, w, id)); }
  @Post(':conversationId/return-to-ai') async returnToAi(@Req() r: AuthRequest, @Param('workspaceId') w: string, @Param('conversationId') id: string) { return this.ok(await this.service.returnToAi(r.user.sub, w, id)); }
  @Post(':conversationId/messages') async reply(@Req() r: AuthRequest, @Param('workspaceId') w: string, @Param('conversationId') id: string, @Body() d: InboxMessageDto) { return this.ok(await this.service.reply(r.user.sub, w, id, d)); }
  @Post(':conversationId/notes') async note(@Req() r: AuthRequest, @Param('workspaceId') w: string, @Param('conversationId') id: string, @Body() d: InboxNoteDto) { return this.ok(await this.service.note(r.user.sub, w, id, d)); }
}
