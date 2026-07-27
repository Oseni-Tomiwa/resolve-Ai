import { IsArray, IsBoolean, IsHexColor, IsIn, IsOptional, IsString, IsUrl, MaxLength, MinLength } from 'class-validator';

export class UpdateWidgetConfigurationDto {
  @IsOptional() @IsBoolean() enabled?: boolean;
  @IsOptional() @IsString() @MinLength(1) @MaxLength(80) name?: string;
  @IsOptional() @IsString() @MaxLength(300) greeting?: string;
  @IsOptional() @IsString() @IsHexColor() accentColor?: string;
  @IsOptional() @IsIn(['BOTTOM_LEFT', 'BOTTOM_RIGHT']) position?: 'BOTTOM_LEFT' | 'BOTTOM_RIGHT';
  @IsOptional() @IsString() @MinLength(1) @MaxLength(40) launcherLabel?: string;
  @IsOptional() @IsArray() @IsString({ each: true }) @MaxLength(200, { each: true }) allowedDomains?: string[];
  @IsOptional() @IsString() @MinLength(1) @MaxLength(100) selectedAgentId?: string;
}

export class WidgetSessionDto {
  @IsOptional() @IsString() @MaxLength(120) sessionId?: string;
  @IsOptional() @IsUrl({ require_tld: false }) @MaxLength(500) pageUrl?: string;
  @IsOptional() @IsUrl({ require_tld: false }) @MaxLength(500) referrer?: string;
}

export class WidgetConversationDto {
  @IsString() @MaxLength(120) title = 'New visitor conversation';
  @IsString() @MinLength(20) @MaxLength(200) sessionId = '';
}

export class WidgetMessageDto {
  @IsString() @MinLength(20) @MaxLength(200) sessionId = '';
  @IsString() @MinLength(1) @MaxLength(4000) content = '';
}
