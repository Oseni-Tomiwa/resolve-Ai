import { Controller, Get, Param, Query, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
// Nest dependency injection needs this constructor at runtime.
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { AuditLogService } from './audit-log.service';
// Nest validation needs this DTO constructor at runtime.
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { AuditLogQueryDto } from './audit-log.dto';
@Controller('workspaces/:workspaceId/audit-logs')
@UseGuards(JwtAuthGuard)
export class AuditLogController { constructor(private readonly service: AuditLogService) {} @Get() async list(@Req() request: { user: { sub: string } }, @Param('workspaceId') workspaceId: string, @Query() query: AuditLogQueryDto) { return { success: true, message: 'Audit logs loaded', data: await this.service.list(request.user.sub, workspaceId, query) }; } }
