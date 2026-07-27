import { Module } from '@nestjs/common';
import { KnowledgeController } from './knowledge.controller';
import { KnowledgeQueueService } from './knowledge-queue.service';
import { KnowledgeService } from './knowledge.service';
import { WorkspaceAccessModule } from '../workspace-access/workspace-access.module';
import { EnvironmentEmbeddingProvider, SEMANTIC_EMBEDDING_PROVIDER, SemanticSearchService } from './semantic-search.service';
import { SemanticSearchController } from './semantic-search.controller';
import { GroundedAnswerController } from './grounded-answer.controller';
import { EnvironmentTextGenerationProvider, GROUNDED_TEXT_PROVIDER, GroundedAnswerService } from './grounded-answer.service';
@Module({ imports: [WorkspaceAccessModule], controllers: [KnowledgeController, SemanticSearchController, GroundedAnswerController], providers: [KnowledgeQueueService, KnowledgeService, SemanticSearchService, EnvironmentEmbeddingProvider, { provide: SEMANTIC_EMBEDDING_PROVIDER, useExisting: EnvironmentEmbeddingProvider }, GroundedAnswerService, EnvironmentTextGenerationProvider, { provide: GROUNDED_TEXT_PROVIDER, useExisting: EnvironmentTextGenerationProvider }] }) export class KnowledgeModule {}
