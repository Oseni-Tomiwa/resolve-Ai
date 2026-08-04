import { IsArray, IsDateString, IsIn, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
export const apiKeyScopes = ['knowledge:read', 'knowledge:write', 'conversations:read', 'conversations:write', 'agents:read', 'widget:read', 'analytics:read'] as const;
export class CreateApiKeyDto { @IsString() @MinLength(1) @MaxLength(80) name!: string; @IsArray() @IsIn(apiKeyScopes, { each: true }) scopes!: string[]; @IsOptional() @IsDateString() expiresAt?: string; }
