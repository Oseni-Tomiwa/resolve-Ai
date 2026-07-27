import { createHash } from 'node:crypto';
import OpenAI from 'openai';

export interface EmbeddingProvider {
  readonly provider: string;
  readonly model: string;
  readonly dimensions: number;
  embed(texts: readonly string[]): Promise<readonly (readonly number[])[]>;
}

export type GroundedAnswerInput = {
  question: string;
  instructions: string;
  context: string;
  maximumOutputTokens: number;
};

export type GroundedAnswerOutput = {
  answer: string;
  citedSourceNumbers: number[];
  provider: string;
  model: string;
  usage: { inputTokens: number; outputTokens: number };
};

export interface TextGenerationProvider {
  readonly provider: string;
  readonly model: string;
  generateGroundedAnswer(input: GroundedAnswerInput): Promise<GroundedAnswerOutput>;
}

export type OpenAIEmbeddingProviderOptions = { apiKey: string; model?: string; dimensions?: number };

export class OpenAIEmbeddingProvider implements EmbeddingProvider {
  readonly provider = 'openai';
  readonly model: string;
  readonly dimensions: number;
  private readonly client: OpenAI;

  constructor(options: OpenAIEmbeddingProviderOptions) {
    this.client = new OpenAI({ apiKey: options.apiKey });
    this.model = options.model ?? 'text-embedding-3-small';
    this.dimensions = options.dimensions ?? 1536;
  }

  async embed(texts: readonly string[]): Promise<readonly (readonly number[])[]> {
    if (texts.length === 0) return [];
    const response = await this.client.embeddings.create({ model: this.model, input: [...texts], dimensions: this.dimensions });
    const vectors = response.data.sort((left, right) => left.index - right.index).map((item) => item.embedding);
    validateEmbeddingVectors(vectors, texts.length, this.dimensions);
    return vectors;
  }
}

export class DeterministicEmbeddingProvider implements EmbeddingProvider {
  readonly provider = 'deterministic-test';
  readonly model = 'deterministic-v1';
  readonly dimensions: number;

  constructor(dimensions = 8) { if (!Number.isInteger(dimensions) || dimensions <= 0) throw new Error('Embedding dimensions must be a positive integer'); this.dimensions = dimensions; }

  async embed(texts: readonly string[]): Promise<readonly (readonly number[])[]> {
    return texts.map((text) => {
      const digest = createHash('sha256').update(text).digest();
      const vector = Array.from({ length: this.dimensions }, (_, index) => ((digest[index % digest.length] ?? 0) / 255) * 2 - 1);
      const magnitude = Math.sqrt(vector.reduce((sum, value) => sum + value * value, 0)) || 1;
      return vector.map((value) => value / magnitude);
    });
  }
}

export function validateEmbeddingVectors(vectors: readonly (readonly number[])[], expectedCount: number, dimensions: number): void {
  if (vectors.length !== expectedCount) throw new Error(`Embedding provider returned ${vectors.length} vectors for ${expectedCount} inputs`);
  if (vectors.some((vector) => vector.length !== dimensions || vector.some((value) => !Number.isFinite(value)))) throw new Error(`Embedding provider returned vectors with invalid dimensions; expected ${dimensions}`);
}

export type OpenAITextGenerationProviderOptions = { apiKey: string; model?: string };

const citedNumbers = (answer: string): number[] => [...new Set(Array.from(answer.matchAll(/\[(\d+)\]/g), (match) => Number(match[1])))].filter((number) => Number.isInteger(number) && number > 0);

export class OpenAITextGenerationProvider implements TextGenerationProvider {
  readonly provider = 'openai';
  readonly model: string;
  private readonly client: OpenAI;

  constructor(options: OpenAITextGenerationProviderOptions) {
    this.client = new OpenAI({ apiKey: options.apiKey });
    this.model = options.model ?? 'gpt-4o-mini';
  }

  async generateGroundedAnswer(input: GroundedAnswerInput): Promise<GroundedAnswerOutput> {
    const response = await this.client.responses.create({ model: this.model, instructions: input.instructions, input: input.context + `\n\nUser question:\n${input.question}`, temperature: 0.2, max_output_tokens: input.maximumOutputTokens });
    const answer = response.output_text.trim();
    if (!answer) throw new Error('Text generation provider returned an empty answer');
    return { answer, citedSourceNumbers: citedNumbers(answer), provider: this.provider, model: this.model, usage: { inputTokens: response.usage?.input_tokens ?? 0, outputTokens: response.usage?.output_tokens ?? 0 } };
  }
}

export class DeterministicTextGenerationProvider implements TextGenerationProvider {
  readonly provider = 'deterministic-test';
  readonly model = 'deterministic-grounded-v1';

  async generateGroundedAnswer(input: GroundedAnswerInput): Promise<GroundedAnswerOutput> {
    const firstSource = input.context.match(/\[Source 1\][\s\S]*?Content:\n([\s\S]*?)(?:\n\n\[Source|$)/)?.[1]?.trim();
    if (!firstSource) return { answer: 'I couldn’t find enough information in this workspace’s knowledge base to answer that.', citedSourceNumbers: [], provider: this.provider, model: this.model, usage: { inputTokens: 0, outputTokens: 0 } };
    return { answer: `The answer is supported by the supplied reference passage. [1]`, citedSourceNumbers: [1], provider: this.provider, model: this.model, usage: { inputTokens: 0, outputTokens: 0 } };
  }
}
