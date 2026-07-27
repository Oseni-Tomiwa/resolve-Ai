import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
// Nest dependency injection needs this constructor at runtime.
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { AgentsService } from './agents.service';
// Nest validation needs DTO constructors at runtime.
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { AgentListQueryDto, CreateAgentDto, UpdateAgentDto } from './dto';
import { agentModels, defaultAgentModel } from './agent.config';

type RequestWithUser = { user: { sub: string } };

@Controller('workspaces/:workspaceId/ai/agents')
@UseGuards(JwtAuthGuard)
export class AgentsController {
  constructor(private readonly service: AgentsService) {}

  @Get('models') models() { return { success: true, message: 'Agent models loaded', data: { items: agentModels, defaultModel: defaultAgentModel } }; }
  @Post() create(@Req() request: RequestWithUser, @Param('workspaceId') workspaceId: string, @Body() dto: CreateAgentDto) { return this.service.create(request.user.sub, workspaceId, dto).then((data) => ({ success: true, message: 'Agent created', data })); }
  @Get() list(@Req() request: RequestWithUser, @Param('workspaceId') workspaceId: string, @Query() query: AgentListQueryDto) { return this.service.list(request.user.sub, workspaceId, query).then((data) => ({ success: true, message: 'Agents loaded', data })); }
  @Get(':agentId') detail(@Req() request: RequestWithUser, @Param('workspaceId') workspaceId: string, @Param('agentId') agentId: string) { return this.service.detail(request.user.sub, workspaceId, agentId).then((data) => ({ success: true, message: 'Agent loaded', data })); }
  @Patch(':agentId') update(@Req() request: RequestWithUser, @Param('workspaceId') workspaceId: string, @Param('agentId') agentId: string, @Body() dto: UpdateAgentDto) { return this.service.update(request.user.sub, workspaceId, agentId, dto).then((data) => ({ success: true, message: 'Agent updated', data })); }
  @Delete(':agentId') remove(@Req() request: RequestWithUser, @Param('workspaceId') workspaceId: string, @Param('agentId') agentId: string) { return this.service.remove(request.user.sub, workspaceId, agentId).then(() => ({ success: true, message: 'Agent deleted', data: null })); }
  @Post(':agentId/set-default') setDefault(@Req() request: RequestWithUser, @Param('workspaceId') workspaceId: string, @Param('agentId') agentId: string) { return this.service.setDefault(request.user.sub, workspaceId, agentId).then((data) => ({ success: true, message: 'Default agent updated', data })); }
}
