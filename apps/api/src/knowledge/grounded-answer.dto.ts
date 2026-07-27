import { IsArray, IsOptional, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';

export class GroundedAnswerDto {
  @IsString() @MinLength(1) @MaxLength(1000) question = '';
  @IsOptional() @IsArray() @IsUUID('4', { each: true }) documentIds?: string[];
}
