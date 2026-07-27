import { Type } from 'class-transformer';
import { IsBoolean, IsEnum, IsIn, IsInt, IsNumber, IsOptional, IsString, Max, MaxLength, Min, MinLength } from 'class-validator';
import { agentModelIds } from './agent.config';

enum AgentStatusDto {
  DRAFT = 'DRAFT',
  ACTIVE = 'ACTIVE',
  DISABLED = 'DISABLED',
}

export class CreateAgentDto {
  @IsString() @MinLength(1) @MaxLength(80) name = '';
  @IsOptional() @IsString() @MaxLength(500) description?: string;
  @IsString() @MinLength(1) @MaxLength(4000) instructions = '';
  @IsOptional() @IsString() @MaxLength(300) greeting?: string;
  @IsOptional() @IsString() @MaxLength(500) fallbackMessage?: string;
  @IsOptional() @IsIn(agentModelIds) model?: string;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) @Max(1) temperature?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(128) @Max(2000) maxOutputTokens?: number;
  @IsOptional() @IsEnum(AgentStatusDto) status?: AgentStatusDto;
  @IsOptional() @Type(() => Boolean) @IsBoolean() isDefault?: boolean;
}

export class UpdateAgentDto {
  @IsOptional() @IsString() @MinLength(1) @MaxLength(80) name?: string;
  @IsOptional() @IsString() @MaxLength(500) description?: string | null;
  @IsOptional() @IsString() @MinLength(1) @MaxLength(4000) instructions?: string;
  @IsOptional() @IsString() @MaxLength(300) greeting?: string | null;
  @IsOptional() @IsString() @MaxLength(500) fallbackMessage?: string | null;
  @IsOptional() @IsIn(agentModelIds) model?: string;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) @Max(1) temperature?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(128) @Max(2000) maxOutputTokens?: number;
  @IsOptional() @IsEnum(AgentStatusDto) status?: AgentStatusDto;
  @IsOptional() @Type(() => Boolean) @IsBoolean() isDefault?: boolean;
}

export class AgentListQueryDto {
  @IsOptional() @IsString() @MaxLength(100) search?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page = 1;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(50) pageSize = 20;
}
