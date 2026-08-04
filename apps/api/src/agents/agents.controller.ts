import { Body, Controller, Delete, Get, HttpException, HttpStatus, Optional, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
// Nest dependency injection needs this constructor at runtime.
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { AgentsService } from './agents.service';
// Nest validation needs DTO constructors at runtime.
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { AgentListQueryDto, AgentPlaygroundDto, CreateAgentDto, UpdateAgentDto } from './dto';
import { agentModels, defaultAgentModel } from './agent.config';
// Nest dependency injection needs this constructor at runtime.
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { RateLimitService } from '../common/rate-limit.service';

type RequestWithUser = { user: { sub: string }; ip?: string };

@Controller('workspaces/:workspaceId/ai/agents')
@UseGuards(JwtAuthGuard)
export class AgentsController {
  constructor(private readonly service: AgentsService, @Optional() private readonly rateLimit?: RateLimitService) {}
  private protect(request: RequestWithUser): void { if (this.rateLimit && !this.rateLimit.allow('agent-playground:' + (request.ip ?? 'unknown'), Number(process.env.PUBLIC_RATE_LIMIT_MAX ?? 60), Number(process.env.PUBLIC_RATE_LIMIT_WINDOW_MS ?? 60000))) throw new HttpException({ code: 'RATE_LIMITED', message: 'Please try again shortly.' }, HttpStatus.TOO_MANY_REQUESTS); }

  @Get('models') models() { return { success: true, message: 'Agent models loaded', data: { items: agentModels, defaultModel: defaultAgentModel } }; }
  @Post() create(@Req() request: RequestWithUser, @Param('workspaceId') workspaceId: string, @Body() dto: CreateAgentDto) { return this.service.create(request.user.sub, workspaceId, dto).then((data) => ({ success: true, message: 'Agent created', data })); }
  @Get() list(@Req() request: RequestWithUser, @Param('workspaceId') workspaceId: string, @Query() query: AgentListQueryDto) { return this.service.list(request.user.sub, workspaceId, query).then((data) => ({ success: true, message: 'Agents loaded', data })); }
  @Get('knowledge-documents') documents(@Req() request: RequestWithUser, @Param('workspaceId') workspaceId: string) { return this.service.selectableDocuments(request.user.sub, workspaceId).then((data) => ({ success: true, message: 'Agent documents loaded', data })); }
  @Get(':agentId') detail(@Req() request: RequestWithUser, @Param('workspaceId') workspaceId: string, @Param('agentId') agentId: string) { return this.service.detail(request.user.sub, workspaceId, agentId).then((data) => ({ success: true, message: 'Agent loaded', data })); }
  @Patch(':agentId') update(@Req() request: RequestWithUser, @Param('workspaceId') workspaceId: string, @Param('agentId') agentId: string, @Body() dto: UpdateAgentDto) { return this.service.update(request.user.sub, workspaceId, agentId, dto).then((data) => ({ success: true, message: 'Agent updated', data })); }
  @Delete(':agentId') remove(@Req() request: RequestWithUser, @Param('workspaceId') workspaceId: string, @Param('agentId') agentId: string) { return this.service.remove(request.user.sub, workspaceId, agentId).then(() => ({ success: true, message: 'Agent deleted', data: null })); }
  @Post(':agentId/duplicate') duplicate(@Req() request: RequestWithUser, @Param('workspaceId') workspaceId: string, @Param('agentId') agentId: string) { return this.service.duplicate(request.user.sub, workspaceId, agentId).then((data) => ({ success: true, message: 'Agent duplicated', data })); }
  @Post(':agentId/publish') publish(@Req() request: RequestWithUser, @Param('workspaceId') workspaceId: string, @Param('agentId') agentId: string) { return this.service.publish(request.user.sub, workspaceId, agentId).then((data) => ({ success: true, message: 'Agent published', data })); }
  @Post(':agentId/archive') archive(@Req() request: RequestWithUser, @Param('workspaceId') workspaceId: string, @Param('agentId') agentId: string) { return this.service.archive(request.user.sub, workspaceId, agentId).then((data) => ({ success: true, message: 'Agent archived', data })); }
  @Post(':agentId/playground') playground(@Req() request: RequestWithUser, @Param('workspaceId') workspaceId: string, @Param('agentId') agentId: string, @Body() dto: AgentPlaygroundDto) { this.protect(request); return this.service.playground(request.user.sub, workspaceId, agentId, dto).then((data) => ({ success: true, message: 'Agent playground response generated', data })); }
  @Post(':agentId/set-default') setDefault(@Req() request: RequestWithUser, @Param('workspaceId') workspaceId: string, @Param('agentId') agentId: string) { return this.service.setDefault(request.user.sub, workspaceId, agentId).then((data) => ({ success: true, message: 'Default agent updated', data })); }
}
