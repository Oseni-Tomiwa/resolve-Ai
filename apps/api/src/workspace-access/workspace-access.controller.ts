import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
// Nest validation and dependency injection need these constructors at runtime.
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { AcceptInvitationDto, CreateInvitationDto, UpdateMemberRoleDto } from './dto';
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { WorkspaceAccessService } from './workspace-access.service';

type RequestWithUser = { user: { sub: string } };
@Controller() export class WorkspaceAccessController {
  constructor(private readonly service: WorkspaceAccessService) {}
  @Post('workspaces/:workspaceId/invitations') @UseGuards(JwtAuthGuard) create(@Req() r: RequestWithUser, @Param('workspaceId') id: string, @Body() dto: CreateInvitationDto) { return this.service.createInvitation(r.user.sub, id, dto).then((data) => ({ success: true, message: 'Invitation created', data })); }
  @Get('workspaces/:workspaceId/invitations') @UseGuards(JwtAuthGuard) listInvitations(@Req() r: RequestWithUser, @Param('workspaceId') id: string) { return this.service.listInvitations(r.user.sub, id).then((data) => ({ success: true, message: 'Invitations loaded', data })); }
  @Post('workspace-invitations/:invitationId/resend') @UseGuards(JwtAuthGuard) resend(@Req() r: RequestWithUser, @Param('invitationId') id: string) { return this.service.resendInvitation(r.user.sub, id).then((data) => ({ success: true, message: 'Invitation resent', data })); }
  @Delete('workspace-invitations/:invitationId') @UseGuards(JwtAuthGuard) revoke(@Req() r: RequestWithUser, @Param('invitationId') id: string) { return this.service.revokeInvitation(r.user.sub, id).then(() => ({ success: true, message: 'Invitation revoked', data: null })); }
  @Get('workspace-invitations/validate') validate(@Query('token') token: string) { return this.service.validateInvitation(token).then((data) => ({ success: true, message: 'Invitation validated', data })); }
  @Post('workspace-invitations/accept') @UseGuards(JwtAuthGuard) accept(@Req() r: RequestWithUser, @Body() dto: AcceptInvitationDto) { return this.service.acceptInvitation(r.user.sub, dto.token).then((data) => ({ success: true, message: 'Invitation accepted', data })); }
  @Get('workspaces/:workspaceId/members') @UseGuards(JwtAuthGuard) members(@Req() r: RequestWithUser, @Param('workspaceId') id: string) { return this.service.listMembers(r.user.sub, id).then((data) => ({ success: true, message: 'Members loaded', data })); }
  @Patch('workspaces/:workspaceId/members/:userId') @UseGuards(JwtAuthGuard) updateMember(@Req() r: RequestWithUser, @Param('workspaceId') workspaceId: string, @Param('userId') userId: string, @Body() dto: UpdateMemberRoleDto) { return this.service.updateMember(r.user.sub, workspaceId, userId, dto).then((data) => ({ success: true, message: 'Member updated', data })); }
  @Delete('workspaces/:workspaceId/members/:userId') @UseGuards(JwtAuthGuard) removeMember(@Req() r: RequestWithUser, @Param('workspaceId') workspaceId: string, @Param('userId') userId: string) { return this.service.removeMember(r.user.sub, workspaceId, userId).then(() => ({ success: true, message: 'Member removed', data: null })); }
}
