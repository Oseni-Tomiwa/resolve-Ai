import { IsArray, IsBoolean, IsIn, IsOptional, IsString, IsUrl, MaxLength, MinLength } from 'class-validator';
export const webhookEvents = ['conversation.created', 'conversation.updated', 'message.created', 'document.ready', 'document.failed', 'agent.published', 'member.updated', 'billing.updated'] as const;
export class CreateWebhookDto { @IsString() @MinLength(1) @MaxLength(80) name!: string; @IsUrl({ protocols: ['http', 'https'], require_protocol: true }) url!: string; @IsArray() @IsIn(webhookEvents, { each: true }) events!: string[]; }
export class UpdateWebhookDto { @IsOptional() @IsBoolean() enabled?: boolean; @IsOptional() @IsArray() @IsIn(webhookEvents, { each: true }) events?: string[]; }
