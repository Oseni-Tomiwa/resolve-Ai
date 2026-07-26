import { IsEmail, IsEnum, IsString, MinLength } from 'class-validator';

export enum WorkspaceInviteRole { ADMIN = 'ADMIN', AGENT = 'AGENT', VIEWER = 'VIEWER' }

export class CreateInvitationDto {
  @IsEmail() email!: string;
  @IsEnum(WorkspaceInviteRole) role!: WorkspaceInviteRole;
}

export class AcceptInvitationDto { @IsString() @MinLength(20) token!: string; }

export class UpdateMemberRoleDto { @IsEnum(WorkspaceInviteRole) role!: WorkspaceInviteRole; }
