import { Type } from 'class-transformer';
import { IsBoolean, IsEnum, IsIn, IsInt, IsNumber, IsOptional, IsString, IsUUID, Max, MaxLength, Min, MinLength } from 'class-validator';
import { agentModelIds } from './agent.config';

export enum AgentStatusDto {
  DRAFT = 'DRAFT',
  ACTIVE = 'ACTIVE',
  DISABLED = 'DISABLED',
  ARCHIVED = 'ARCHIVED',
}

export class CreateAgentDto {
  @IsString() @MinLength(1) @MaxLength(80) name = '';
  @IsOptional() @IsString() @MaxLength(500) description?: string;
  @IsOptional() @IsString() @MinLength(1) @MaxLength(80) slug?: string;
  @IsString() @MinLength(1) @MaxLength(4000) instructions = '';
  @IsOptional() @IsString() @MaxLength(300) greeting?: string;
  @IsOptional() @IsString() @MaxLength(500) fallbackMessage?: string;
  @IsOptional() @IsIn(agentModelIds) model?: string;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) @Max(1) temperature?: number;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) @Max(1) topP?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(128) @Max(2000) maxOutputTokens?: number;
  @IsOptional() @IsBoolean() requireCitations?: boolean;
  @IsOptional() @IsBoolean() groundedOnly?: boolean;
  @IsOptional() @IsBoolean() allowFollowUpQuestions?: boolean;
  @IsOptional() @IsBoolean() allowGeneralKnowledge?: boolean;
  @IsOptional() @IsUUID('4', { each: true }) documentIds?: string[];
  @IsOptional() @IsEnum(AgentStatusDto) status?: AgentStatusDto;
  @IsOptional() @Type(() => Boolean) @IsBoolean() isDefault?: boolean;
}

export class UpdateAgentDto {
  @IsOptional() @IsString() @MinLength(1) @MaxLength(80) name?: string;
  @IsOptional() @IsString() @MaxLength(500) description?: string | null;
  @IsOptional() @IsString() @MinLength(1) @MaxLength(80) slug?: string;
  @IsOptional() @IsString() @MinLength(1) @MaxLength(4000) instructions?: string;
  @IsOptional() @IsString() @MaxLength(300) greeting?: string | null;
  @IsOptional() @IsString() @MaxLength(500) fallbackMessage?: string | null;
  @IsOptional() @IsIn(agentModelIds) model?: string;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) @Max(1) temperature?: number;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) @Max(1) topP?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(128) @Max(2000) maxOutputTokens?: number;
  @IsOptional() @IsBoolean() requireCitations?: boolean;
  @IsOptional() @IsBoolean() groundedOnly?: boolean;
  @IsOptional() @IsBoolean() allowFollowUpQuestions?: boolean;
  @IsOptional() @IsBoolean() allowGeneralKnowledge?: boolean;
  @IsOptional() @IsUUID('4', { each: true }) documentIds?: string[];
  @IsOptional() @IsEnum(AgentStatusDto) status?: AgentStatusDto;
  @IsOptional() @Type(() => Boolean) @IsBoolean() isDefault?: boolean;
}

export class AgentListQueryDto {
  @IsOptional() @IsString() @MaxLength(100) search?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page = 1;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(50) pageSize = 20;
}

export class AgentPlaygroundDto {
  @IsString() @MinLength(1) @MaxLength(1000) question = '';
}
