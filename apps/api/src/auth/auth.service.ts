import { createHash, randomBytes } from 'node:crypto';
import { Inject, Injectable, UnauthorizedException, ConflictException } from '@nestjs/common';
import * as argon2 from 'argon2';
import * as jwt from 'jsonwebtoken';
import { PrismaClient } from '@resolveai/database';
import { LoginDto, RegisterDto } from './dto';

type PublicUser = { id: string; firstName: string; lastName: string; email: string; emailVerifiedAt: Date | null; createdAt: Date; updatedAt: Date };
type Tokens = { accessToken: string; refreshToken: string };
const publicUser = (user: PublicUser & { passwordHash: string }): PublicUser => { const { passwordHash: _passwordHash, ...safe } = user; return safe; };
const hashToken = (token: string): string => createHash('sha256').update(token).digest('hex');

@Injectable()
export class AuthService {
  constructor(@Inject('PRISMA') private readonly db: PrismaClient) {}
  private issueTokens(userId: string): Tokens { const refreshToken = randomBytes(48).toString('base64url'); return { accessToken: jwt.sign({ sub: userId }, process.env.JWT_ACCESS_SECRET ?? 'development-access-secret-32-chars', { expiresIn: '15m' }), refreshToken }; }
  async register(dto: RegisterDto): Promise<{ user: PublicUser; tokens: Tokens }> { const email = dto.email.trim().toLowerCase(); const existing = await this.db.user.findUnique({ where: { email } }); if (existing) throw new ConflictException('Unable to create account with these details'); const user = await this.db.user.create({ data: { firstName: dto.firstName.trim(), lastName: dto.lastName.trim(), email, passwordHash: await argon2.hash(dto.password) } }); const tokens = this.issueTokens(user.id); await this.persistRefresh(user.id, tokens.refreshToken); return { user: publicUser(user), tokens }; }
  async login(dto: LoginDto): Promise<{ user: PublicUser; tokens: Tokens }> { const user = await this.db.user.findUnique({ where: { email: dto.email.trim().toLowerCase() } }); if (!user || !(await argon2.verify(user.passwordHash, dto.password))) throw new UnauthorizedException('Invalid email or password'); const tokens = this.issueTokens(user.id); await this.persistRefresh(user.id, tokens.refreshToken); return { user: publicUser(user), tokens }; }
  private async persistRefresh(userId: string, token: string): Promise<void> { await this.db.refreshToken.create({ data: { userId, tokenHash: hashToken(token), expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) } }); }
  async refresh(token: string): Promise<Tokens> { const stored = await this.db.refreshToken.findUnique({ where: { tokenHash: hashToken(token) } }); if (!stored || stored.revokedAt || stored.expiresAt < new Date()) throw new UnauthorizedException('Invalid refresh token'); const next = this.issueTokens(stored.userId); await this.db.$transaction([this.db.refreshToken.update({ where: { id: stored.id }, data: { revokedAt: new Date() } }), this.db.refreshToken.create({ data: { userId: stored.userId, tokenHash: hashToken(next.refreshToken), expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) } })]); return next; }
  async logout(token: string): Promise<void> { await this.db.refreshToken.updateMany({ where: { tokenHash: hashToken(token), revokedAt: null }, data: { revokedAt: new Date() } }); }
  async me(userId: string): Promise<PublicUser> { const user = await this.db.user.findUnique({ where: { id: userId } }); if (!user) throw new UnauthorizedException('Unauthorized'); return publicUser(user); }
}
