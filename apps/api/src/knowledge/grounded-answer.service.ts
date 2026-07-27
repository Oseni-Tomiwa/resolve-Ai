import { loadGenerationEnv } from '@resolveai/config';
import { OpenAITextGenerationProvider, type GroundedAnswerOutput, type TextGenerationProvider } from '@resolveai/ai';
import { BadRequestException, HttpException, HttpStatus, Inject, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
// Nest dependency injection needs this constructor at runtime.
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { SemanticSearchService } from './semantic-search.service';
import type { GroundedAnswerDto } from './grounded-answer.dto';
import { buildGroundedContext, groundedAnswerInstructions } from './grounded-prompt';

export const GROUNDED_TEXT_PROVIDER = 'GROUNDED_TEXT_PROVIDER';
const insufficientAnswer = 'I couldn’t find enough information in this workspace’s knowledge base to answer that.';
const contextCharacterLimit = 12000;
type Source = { number: number; documentId: string; documentName: string; chunkIndex: number; contentPreview: string; similarityScore: number; cited: boolean };
const generationEnv = () => { try { return loadGenerationEnv(process.env); } catch { throw new ServiceUnavailableException('Grounded answer generation configuration is invalid'); } };

@Injectable()
export class EnvironmentTextGenerationProvider implements TextGenerationProvider {
  readonly provider = 'openai';
  get model(): string { return generationEnv().OPENAI_GENERATION_MODEL; }
  async generateGroundedAnswer(input: Parameters<TextGenerationProvider['generateGroundedAnswer']>[0]): Promise<GroundedAnswerOutput> {
    const env = generationEnv();
    if (!env.OPENAI_API_KEY) throw new ServiceUnavailableException('Grounded answer generation is not configured');
    return new OpenAITextGenerationProvider({ apiKey: env.OPENAI_API_KEY, model: env.OPENAI_GENERATION_MODEL }).generateGroundedAnswer(input);
  }
}

const preview = (content: string): string => content.replace(/\s+/g, ' ').trim().slice(0, 240);
const normalizeForDeduplication = (content: string): string => content.replace(/\s+/g, ' ').trim().toLowerCase();
const heavilyOverlaps = (left: string, right: string): boolean => { const shorter = left.length <= right.length ? left : right; const longer = left.length <= right.length ? right : left; return shorter.length >= 120 && longer.includes(shorter); };

@Injectable()
export class GroundedAnswerService {
  private readonly lastRequestAt = new Map<string, number>();
  constructor(private readonly semanticSearch: SemanticSearchService, @Inject(GROUNDED_TEXT_PROVIDER) private readonly generationProvider: TextGenerationProvider) {}

  async answer(userId: string, workspaceId: string, input: GroundedAnswerDto) {
    const question = input.question.trim();
    if (!question) throw new BadRequestException('Question cannot be empty');
    if (question.length > 1000) throw new BadRequestException('Question must be 1000 characters or fewer');
    const requestKey = `${userId}:${workspaceId}`;
    const now = Date.now();
    if (now - (this.lastRequestAt.get(requestKey) ?? 0) < 2000) throw new HttpException('Please wait before asking another question', HttpStatus.TOO_MANY_REQUESTS);
    this.lastRequestAt.set(requestKey, now);
    const env = generationEnv();
    const requestId = randomUUID();
    const startedAt = Date.now();
    const retrieval = await this.semanticSearch.search(userId, workspaceId, { query: question, limit: env.AI_RETRIEVAL_LIMIT, minimumScore: env.AI_MINIMUM_SCORE, documentIds: input.documentIds });
    const selected = [] as typeof retrieval.results;
    let contextLength = 0;
    for (const result of retrieval.results) { const normalized = normalizeForDeduplication(result.content); if (selected.some((candidate) => normalized === normalizeForDeduplication(candidate.content) || heavilyOverlaps(normalized, normalizeForDeduplication(candidate.content)))) continue; if (contextLength + result.content.length > contextCharacterLimit) break; selected.push(result); contextLength += result.content.length; }
    if (selected.length === 0) { console.info(JSON.stringify({ event: 'knowledge.answer', requestId, workspaceId, userId, retrievedSourceCount: 0, model: null, latencyMs: Date.now() - startedAt, success: true, category: 'insufficient_context' })); return { answer: insufficientAnswer, sources: [], provider: null, model: null, usage: { inputTokens: 0, outputTokens: 0 } }; }
    const promptSources = selected.map((result, index) => ({ number: index + 1, documentName: result.document.name, chunkIndex: result.chunkIndex, content: result.content }));
    const generated = await this.generate({ question, context: buildGroundedContext(promptSources), instructions: groundedAnswerInstructions, maximumOutputTokens: env.AI_MAX_OUTPUT_TOKENS });
    const validCitationNumbers = new Set(generated.citedSourceNumbers.filter((number) => number >= 1 && number <= selected.length));
    const sources: Source[] = selected.map((result, index) => ({ number: index + 1, documentId: result.document.id, documentName: result.document.name, chunkIndex: result.chunkIndex, contentPreview: preview(result.content), similarityScore: result.similarityScore, cited: validCitationNumbers.has(index + 1) }));
    console.info(JSON.stringify({ event: 'knowledge.answer', requestId, workspaceId, userId, retrievedSourceCount: selected.length, model: generated.model, latencyMs: Date.now() - startedAt, inputTokens: generated.usage.inputTokens, outputTokens: generated.usage.outputTokens, success: true, category: 'generated' }));
    return { answer: generated.answer, sources, provider: generated.provider, model: generated.model, usage: generated.usage };
  }

  private async generate(input: Parameters<TextGenerationProvider['generateGroundedAnswer']>[0]): Promise<GroundedAnswerOutput> {
    try { return await this.generationProvider.generateGroundedAnswer({ ...input, instructions: groundedAnswerInstructions }); } catch (error) { if (error instanceof ServiceUnavailableException) throw error; throw new ServiceUnavailableException('Grounded answer generation is currently unavailable'); }
  }
}
