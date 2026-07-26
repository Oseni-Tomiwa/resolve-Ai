import { Controller, Get, Param, Post, Body, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import type { WorkspaceDto } from './dto';
import { WorkspacesService } from './workspaces.service';
@Controller() @UseGuards(JwtAuthGuard)
export class WorkspacesController { constructor(private readonly service: WorkspacesService) {} @Post('organizations/:organizationId/workspaces') create(@Req() r: { user: { sub: string } }, @Param('organizationId') org: string, @Body() dto: WorkspaceDto) { return this.service.create(r.user.sub, org, dto).then((data) => ({ success: true, message: 'Workspace created', data })); } @Get('organizations/:organizationId/workspaces') list(@Req() r: { user: { sub: string } }, @Param('organizationId') org: string) { return this.service.list(r.user.sub, org).then((data) => ({ success: true, message: 'Workspaces loaded', data })); } @Get('workspaces/:workspaceId') get(@Req() r: { user: { sub: string } }, @Param('workspaceId') id: string) { return this.service.get(r.user.sub, id).then((data) => ({ success: true, message: 'Workspace loaded', data })); } }
