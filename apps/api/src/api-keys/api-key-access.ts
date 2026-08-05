import { SetMetadata, ForbiddenException, Injectable, type CanActivate, type ExecutionContext } from '@nestjs/common';
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { ApiKeyGuard } from './api-key.guard';
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
export const API_KEY_SCOPE = 'resolveai.api-key-scope';
export const RequireApiKeyScope = (scope: string) => SetMetadata(API_KEY_SCOPE, scope);
@Injectable()
export class JwtOrApiKeyGuard implements CanActivate { constructor(private readonly jwt: JwtAuthGuard, private readonly apiKey: ApiKeyGuard) {} canActivate(context: ExecutionContext): boolean | Promise<boolean> { const request = context.switchToHttp().getRequest<{ headers: { authorization?: string; ['x-resolveai-key']?: string } }>(); const raw = (request.headers['x-resolveai-key'] ?? request.headers.authorization)?.replace(/^Bearer\s+/i, ''); return raw?.startsWith('rai_') ? this.apiKey.canActivate(context) : this.jwt.canActivate(context); } }
@Injectable()
export class ApiKeyScopeGuard implements CanActivate { canActivate(context: ExecutionContext): boolean { const handler = context.getHandler?.(); const target = context.getClass?.(); const required = (handler ? Reflect.getMetadata(API_KEY_SCOPE, handler) : undefined) ?? (target ? Reflect.getMetadata(API_KEY_SCOPE, target) : undefined); const request = context.switchToHttp().getRequest<{ apiKey?: { scopes: string[] } }>(); if (!request.apiKey || !required) return true; if (!request.apiKey.scopes.includes(required)) throw new ForbiddenException({ code: 'API_KEY_SCOPE_REQUIRED', message: 'This API key does not have the required scope.' }); return true; } }
