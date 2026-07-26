import { Body, Controller, Delete, Get, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
// Nest validation and dependency injection need these constructors at runtime.
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { OrganizationDto } from './dto';
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { OrganizationsService } from './organizations.service';
type RequestWithUser = { user: { sub: string } };
@Controller('organizations') @UseGuards(JwtAuthGuard)
export class OrganizationsController {
  constructor(private readonly service: OrganizationsService) {}
  @Post() create(@Req() r: RequestWithUser, @Body() dto: OrganizationDto) { return this.service.create(r.user.sub, dto).then((data) => ({ success: true, message: 'Organization created', data })); }
  @Get() list(@Req() r: RequestWithUser) { return this.service.list(r.user.sub).then((data) => ({ success: true, message: 'Organizations loaded', data })); }
  @Get(':organizationId') get(@Req() r: RequestWithUser, @Param('organizationId') id: string) { return this.service.get(r.user.sub, id).then((data) => ({ success: true, message: 'Organization loaded', data })); }
  @Patch(':organizationId') update(@Req() r: RequestWithUser, @Param('organizationId') id: string, @Body() dto: OrganizationDto) { return this.service.update(r.user.sub, id, dto).then((data) => ({ success: true, message: 'Organization updated', data })); }
  @Delete(':organizationId') async remove(@Req() r: RequestWithUser, @Param('organizationId') id: string) { await this.service.remove(r.user.sub, id); return { success: true, message: 'Organization deleted', data: null }; }
}
