import { IsArray, IsInt, IsOptional, IsString, IsUUID, Max, MaxLength, Min, MinLength } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateConversationDto {
  @IsOptional() @IsString() @MaxLength(120) title?: string;
  @IsOptional() @IsUUID('4') agentId?: string;
}

export class UpdateConversationDto {
  @IsString() @MinLength(1) @MaxLength(120) title = '';
}

export class ConversationListQueryDto {
  @IsOptional() @IsString() @MaxLength(100) search?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page = 1;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(50) pageSize = 20;
}

export class ConversationDetailQueryDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page = 1;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) pageSize = 50;
}

export class StreamMessageDto {
  @IsString() @MinLength(1) @MaxLength(4000) content = '';
  @IsOptional() @IsArray() @IsUUID('4', { each: true }) documentIds?: string[];
}
