import { IsEmail, IsOptional, IsString, Matches, MinLength } from 'class-validator';
export class RegisterDto { @IsString() @MinLength(1) firstName!: string; @IsString() @MinLength(1) lastName!: string; @IsEmail() email!: string; @IsString() @MinLength(12) @Matches(/[A-Z]/) @Matches(/[a-z]/) @Matches(/[0-9]/) password!: string; }
export class LoginDto { @IsEmail() email!: string; @IsString() @MinLength(1) password!: string; }
export class RefreshDto { @IsOptional() @IsString() @MinLength(20) refreshToken?: string; }
