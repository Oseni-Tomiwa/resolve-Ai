import { z } from 'zod';

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
  OPENAI_API_KEY: z.string().min(1).optional(),
  OPENAI_EMBEDDING_MODEL: z.string().min(1).default('text-embedding-3-small'),
  EMBEDDING_BATCH_SIZE: z.coerce.number().int().positive().max(100).default(50),
});
export type EmbeddingEnv = z.infer<typeof embeddingEnvSchema>;
export const loadEmbeddingEnv = (input: Record<string, string | undefined>): EmbeddingEnv => embeddingEnvSchema.parse(input);
export const generationEnvSchema = z.object({
  OPENAI_API_KEY: z.string().min(1).optional(),
  OPENAI_GENERATION_MODEL: z.string().min(1).default('gpt-4o-mini'),
  AI_MAX_OUTPUT_TOKENS: z.coerce.number().int().positive().max(2000).default(800),
  AI_RETRIEVAL_LIMIT: z.coerce.number().int().positive().max(20).default(5),
  AI_MINIMUM_SCORE: z.coerce.number().min(0).max(1).default(0.65),
});
export type GenerationEnv = z.infer<typeof generationEnvSchema>;
export const loadGenerationEnv = (input: Record<string, string | undefined>): GenerationEnv => generationEnvSchema.parse(input);
export type Env = z.infer<typeof envSchema>;
export const loadEnv = (input: Record<string, string | undefined>): Env => envSchema.parse(input);
