import { IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class KnowledgeListQueryDto {
  @IsOptional() @IsString() search?: string;
  @IsOptional() @IsIn(['UPLOADED', 'PROCESSING', 'EMBEDDING', 'READY', 'FAILED']) status?: string;
  @IsOptional() @IsInt() @Min(1) page = 1;
  @IsOptional() @IsInt() @Min(1) @Max(50) pageSize = 20;
}

export class KnowledgeChunkQueryDto {
  @IsOptional() @IsInt() @Min(1) page = 1;
  @IsOptional() @IsInt() @Min(1) @Max(100) limit = 20;
  @IsOptional() @IsIn(['true', 'false']) includeContent = 'true';
}
