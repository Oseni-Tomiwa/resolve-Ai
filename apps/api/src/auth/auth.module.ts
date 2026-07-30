import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { WorkspaceAccessModule } from '../workspace-access/workspace-access.module';
@Module({ imports: [WorkspaceAccessModule], controllers: [AuthController], providers: [AuthService], exports: [AuthService] }) export class AuthModule {}
