import { Module } from '@nestjs/common';
import { KnowledgeModule } from '../knowledge/knowledge.module';
import { AgentsController } from './agents.controller';
import { AgentsService } from './agents.service';

@Module({ imports: [KnowledgeModule], controllers: [AgentsController], providers: [AgentsService], exports: [AgentsService] })
export class AgentsModule {}
