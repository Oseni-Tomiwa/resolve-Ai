import { Body, Controller, Delete, Get, Param, Post, Query, Req, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
// Nest validation and dependency injection need these constructors at runtime.
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { KnowledgeChunkQueryDto, KnowledgeListQueryDto, KnowledgeUrlDto } from './dto';
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { KnowledgeService } from './knowledge.service';

type RequestWithUser = { user: { sub: string } };
@Controller('workspaces/:workspaceId/knowledge/documents') @UseGuards(JwtAuthGuard)
export class KnowledgeController {
  constructor(private readonly service: KnowledgeService) {}
  @Post() @UseInterceptors(FileInterceptor('file', { storage: memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } })) upload(@Req() request: RequestWithUser, @Param('workspaceId') workspaceId: string, @UploadedFile() file: Express.Multer.File) { return this.service.upload(request.user.sub, workspaceId, file).then((data) => ({ success: true, message: 'Document uploaded', data })); }
  @Post('url') addUrl(@Req() request: RequestWithUser, @Param('workspaceId') workspaceId: string, @Body() dto: KnowledgeUrlDto) { return this.service.addUrl(request.user.sub, workspaceId, dto.url).then((data) => ({ success: true, message: 'Website source queued', data })); }
  @Get() list(@Req() request: RequestWithUser, @Param('workspaceId') workspaceId: string, @Query() query: KnowledgeListQueryDto) { return this.service.list(request.user.sub, workspaceId, query).then((data) => ({ success: true, message: 'Documents loaded', data })); }
  @Get(':documentId') detail(@Req() request: RequestWithUser, @Param('workspaceId') workspaceId: string, @Param('documentId') documentId: string) { return this.service.detail(request.user.sub, workspaceId, documentId).then((data) => ({ success: true, message: 'Document loaded', data })); }
  @Get(':documentId/chunks') chunks(@Req() request: RequestWithUser, @Param('workspaceId') workspaceId: string, @Param('documentId') documentId: string, @Query() query: KnowledgeChunkQueryDto) { return this.service.chunks(request.user.sub, workspaceId, documentId, query).then((data) => ({ success: true, message: 'Document chunks loaded', data })); }
  @Post(':documentId/reprocess') reprocess(@Req() request: RequestWithUser, @Param('workspaceId') workspaceId: string, @Param('documentId') documentId: string) { return this.service.reprocess(request.user.sub, workspaceId, documentId).then((data) => ({ success: true, message: 'Document reprocessing queued', data })); }
  @Delete(':documentId') remove(@Req() request: RequestWithUser, @Param('workspaceId') workspaceId: string, @Param('documentId') documentId: string) { return this.service.remove(request.user.sub, workspaceId, documentId).then(() => ({ success: true, message: 'Document deleted', data: null })); }
}
