import { Module } from '@nestjs/common';
import { AuthModule } from './auth/auth.module';
import { DatabaseModule } from './database/database.module';
import { HealthModule } from './health/health.module';
import { OrganizationsModule } from './organizations/organizations.module';
import { UsersModule } from './users/users.module';
import { WorkspacesModule } from './workspaces/workspaces.module';
@Module({ imports: [DatabaseModule, HealthModule, AuthModule, UsersModule, OrganizationsModule, WorkspacesModule] })
export class AppModule {}
