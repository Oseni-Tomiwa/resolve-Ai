import { createHash, randomBytes } from 'node:crypto';
import { ConflictException, ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import type { PrismaClient } from '@resolveai/database';
// Nest dependency injection needs this constructor at runtime.
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { WorkspaceAccessService } from '../workspace-access/workspace-access.service';
const hash = (value: string): string => createHash('sha256').update(value).digest('hex');
@Injectable()
export class ApiKeysService {
  constructor(@Inject('PRISMA') private readonly db: PrismaClient, private readonly access: WorkspaceAccessService) {}
  private async manage(userId: string, workspaceId: string): Promise<void> { const rights = await this.access.getAccess(userId, workspaceId); if (rights.organizationRole !== 'OWNER' && rights.organizationRole !== 'ADMIN' && rights.workspaceRole !== 'ADMIN') throw new ForbiddenException('Only workspace managers can manage API keys'); }
  async list(userId: string, workspaceId: string) { await this.access.assertMember(userId, workspaceId); return this.db.workspaceApiKey.findMany({ where: { workspaceId }, orderBy: { createdAt: 'desc' }, select: { id: true, name: true, prefix: true, scopes: true, expiresAt: true, revokedAt: true, lastUsedAt: true, createdAt: true } }); }
  async create(userId: string, workspaceId: string, name: string, scopes: string[], expiresAt?: string) { await this.manage(userId, workspaceId); const secret = randomBytes(32).toString('base64url'); const prefix = 'rai_' + randomBytes(6).toString('hex'); try { const key = await this.db.workspaceApiKey.create({ data: { workspaceId, createdByUserId: userId, name: name.trim(), prefix, secretHash: hash(prefix + '_' + secret), scopes, expiresAt: expiresAt ? new Date(expiresAt) : undefined } }); return { id: key.id, name: key.name, prefix, key: prefix + '_' + secret, scopes: key.scopes, expiresAt: key.expiresAt }; } catch (error) { if ((error as { code?: string }).code === 'P2002') throw new ConflictException('An API key with this name already exists'); throw error; } }
  async revoke(userId: string, workspaceId: string, id: string) { await this.manage(userId, workspaceId); const key = await this.db.workspaceApiKey.findFirst({ where: { id, workspaceId } }); if (!key) throw new NotFoundException('API key not found'); await this.db.workspaceApiKey.update({ where: { id }, data: { revokedAt: new Date() } }); }
}
