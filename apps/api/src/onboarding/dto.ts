import { OrganizationIndustry, OrganizationTeamSize } from '@resolveai/database';
import { IsEnum, IsString, MinLength } from 'class-validator';

export class OnboardingDto {
  @IsString() @MinLength(2) organizationName!: string;
  @IsString() @MinLength(1) organizationSlug!: string;
  @IsString() @MinLength(2) workspaceName!: string;
  @IsString() @MinLength(1) workspaceSlug!: string;
  @IsEnum(OrganizationIndustry) industry!: OrganizationIndustry;
  @IsEnum(OrganizationTeamSize) teamSize!: OrganizationTeamSize;
}
