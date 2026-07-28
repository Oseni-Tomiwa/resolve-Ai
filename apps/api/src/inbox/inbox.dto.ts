import { IsIn, IsOptional, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';

export class InboxListDto {
  @IsOptional() @IsIn(['OPEN', 'PENDING', 'RESOLVED']) status?: 'OPEN' | 'PENDING' | 'RESOLVED';
  @IsOptional() @IsIn(['mine', 'unassigned', 'all']) assignment?: 'mine' | 'unassigned' | 'all';
  @IsOptional() @IsString() @MaxLength(120) search?: string;
}
export class InboxAssignmentDto { @IsOptional() @IsUUID() assignedUserId?: string | null; }
export class InboxPriorityDto { @IsIn(['LOW', 'NORMAL', 'HIGH', 'URGENT']) priority!: 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT'; }
export class InboxStatusDto { @IsIn(['OPEN', 'PENDING', 'RESOLVED']) status!: 'OPEN' | 'PENDING' | 'RESOLVED'; }
export class InboxMessageDto { @IsString() @MinLength(1) @MaxLength(4000) content!: string; @IsOptional() @IsString() @MaxLength(120) clientMessageId?: string; }
export class InboxNoteDto { @IsString() @MinLength(1) @MaxLength(4000) content!: string; }
