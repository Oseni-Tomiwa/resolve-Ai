import { z } from 'zod';
import { config as loadDotenv } from 'dotenv';
import { resolve } from 'node:path';

export const generationModels = [{ id: 'gpt-4o-mini', label: 'GPT-4o mini' }] as const;
export const embeddingModels = [{ id: 'text-embedding-3-small', label: 'text-embedding-3-small' }] as const;
export const generationModelIds = generationModels.map((model) => model.id) as [string, ...string[]];
export const embeddingModelIds = embeddingModels.map((model) => model.id) as [string, ...string[]];
const optionalOpenAIKey = z.preprocess((value) => value === '' ? undefined : value, z.string().min(1).optional());

export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  API_PORT: z.coerce.number().int().positive().default(4000),
  WEB_URL: z.string().url().default('http://localhost:3000'),
  DATABASE_URL: z.string().min(1),
  REDIS_URL: z.string().url(),
  JWT_ACCESS_SECRET: z.string().min(32),
  JWT_REFRESH_SECRET: z.string().min(32),
  JWT_ACCESS_TTL: z.string().default('15m'),
  JWT_REFRESH_TTL: z.string().default('30d'),
});
export const embeddingEnvSchema = z.object({
  OPENAI_API_KEY: optionalOpenAIKey,
  OPENAI_EMBEDDING_MODEL: z.enum(embeddingModelIds).default('text-embedding-3-small'),
  EMBEDDING_BATCH_SIZE: z.coerce.number().int().min(1).max(100).default(50),
});
export type EmbeddingEnv = z.infer<typeof embeddingEnvSchema>;
export const loadEmbeddingEnv = (input: Record<string, string | undefined>): EmbeddingEnv => embeddingEnvSchema.parse(input);
export const generationEnvSchema = z.object({
  OPENAI_API_KEY: optionalOpenAIKey,
  OPENAI_GENERATION_MODEL: z.enum(generationModelIds).default('gpt-4o-mini'),
  AI_MAX_OUTPUT_TOKENS: z.coerce.number().int().min(128).max(2000).default(800),
  AI_RETRIEVAL_LIMIT: z.coerce.number().int().min(1).max(20).default(5),
  AI_MINIMUM_SCORE: z.coerce.number().min(0).max(1).default(0.65),
});
export type GenerationEnv = z.infer<typeof generationEnvSchema>;
export const loadGenerationEnv = (input: Record<string, string | undefined>): GenerationEnv => generationEnvSchema.parse(input);
export type AIEnvironment = EmbeddingEnv & GenerationEnv & { EMBEDDING_BATCH_SIZE: number };
export const loadAIEnv = (input: Record<string, string | undefined>): AIEnvironment => ({ ...loadEmbeddingEnv(input), ...loadGenerationEnv(input) });
export type Env = z.infer<typeof envSchema>;
export const loadEnv = (input: Record<string, string | undefined>): Env => envSchema.parse(input);

export function loadRootEnv(): string {
  const envFilePath = resolve(__dirname, '../../../.env');
  loadDotenv({ path: envFilePath, override: false });
  if (process.env.NODE_ENV !== 'production') {
    console.info(JSON.stringify({ event: 'environment.loaded', cwd: process.cwd(), envFilePath, databaseUrlConfigured: Boolean(process.env.DATABASE_URL), nodeEnv: process.env.NODE_ENV ?? 'undefined' }));
  }
  return envFilePath;
}
