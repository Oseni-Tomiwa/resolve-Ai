import { Module } from '@nestjs/common';
import { loadEmbeddingEnv, loadGenerationEnv } from '@resolveai/config';
import { KnowledgeController } from './knowledge.controller';
import { KnowledgeQueueService } from './knowledge-queue.service';
import { KnowledgeService } from './knowledge.service';
import { WorkspaceAccessModule } from '../workspace-access/workspace-access.module';
import { EMBEDDING_CONFIG, EnvironmentEmbeddingProvider, SEMANTIC_EMBEDDING_PROVIDER, SemanticSearchService } from './semantic-search.service';
import { SemanticSearchController } from './semantic-search.controller';
import { GroundedAnswerController } from './grounded-answer.controller';
import { EnvironmentTextGenerationProvider, GENERATION_CONFIG, GROUNDED_TEXT_PROVIDER, GroundedAnswerService } from './grounded-answer.service';
@Module({ imports: [WorkspaceAccessModule], controllers: [KnowledgeController, SemanticSearchController, GroundedAnswerController], providers: [KnowledgeQueueService, KnowledgeService, SemanticSearchService, EnvironmentEmbeddingProvider, { provide: EMBEDDING_CONFIG, useFactory: () => loadEmbeddingEnv(process.env) }, { provide: SEMANTIC_EMBEDDING_PROVIDER, useExisting: EnvironmentEmbeddingProvider }, GroundedAnswerService, EnvironmentTextGenerationProvider, { provide: GENERATION_CONFIG, useFactory: () => loadGenerationEnv(process.env) }, { provide: GROUNDED_TEXT_PROVIDER, useExisting: EnvironmentTextGenerationProvider }], exports: [GroundedAnswerService] }) export class KnowledgeModule {}
