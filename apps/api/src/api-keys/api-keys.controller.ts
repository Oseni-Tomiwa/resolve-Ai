import { Body, Controller, Delete, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
// Nest dependency injection needs this constructor at runtime.
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { ApiKeysService } from './api-keys.service';
import type { CreateApiKeyDto } from './dto';
@Controller('workspaces/:workspaceId/api-keys') @UseGuards(JwtAuthGuard)
export class ApiKeysController { constructor(private readonly service: ApiKeysService) {} @Get() list(@Req() req: { user: { sub: string } }, @Param('workspaceId') id: string) { return this.service.list(req.user.sub, id).then((data) => ({ success: true, message: 'API keys loaded', data })); } @Post() create(@Req() req: { user: { sub: string } }, @Param('workspaceId') id: string, @Body() dto: CreateApiKeyDto) { return this.service.create(req.user.sub, id, dto.name, dto.scopes, dto.expiresAt).then((data) => ({ success: true, message: 'API key created. Store it now; it will not be shown again.', data })); } @Delete(':keyId') revoke(@Req() req: { user: { sub: string } }, @Param('workspaceId') id: string, @Param('keyId') keyId: string) { return this.service.revoke(req.user.sub, id, keyId).then(() => ({ success: true, message: 'API key revoked', data: null })); } }
