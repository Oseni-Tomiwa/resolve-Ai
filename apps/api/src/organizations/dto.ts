import { IsString, Matches, MinLength } from 'class-validator';
export class OrganizationDto { @IsString() @MinLength(2) name!: string; @IsString() @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/) slug!: string; }
