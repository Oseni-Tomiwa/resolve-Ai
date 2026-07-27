import { Type } from 'class-transformer';
import { IsArray, IsInt, IsNumber, IsOptional, IsString, IsUUID, Max, MaxLength, Min, MinLength } from 'class-validator';

export class SemanticSearchDto {
  @IsString() @MinLength(1) @MaxLength(1000) query = '';
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(20) limit = 5;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) @Max(1) minimumScore = 0.65;
  @IsOptional() @IsArray() @IsUUID('4', { each: true }) documentIds?: string[];
}
