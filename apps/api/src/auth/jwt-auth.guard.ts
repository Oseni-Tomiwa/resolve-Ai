import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import * as jwt from 'jsonwebtoken';
@Injectable()
export class JwtAuthGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean { const request = context.switchToHttp().getRequest<{ headers: { authorization?: string }; user?: { sub: string } }>(); const value = request.headers.authorization?.replace(/^Bearer\s+/i, ''); if (!value) throw new UnauthorizedException('Authentication required'); try { request.user = jwt.verify(value, process.env.JWT_ACCESS_SECRET ?? 'development-access-secret-32-chars') as { sub: string }; return true; } catch { throw new UnauthorizedException('Invalid access token'); } }
}
