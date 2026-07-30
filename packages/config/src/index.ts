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
  APP_NAME: z.string().min(1).default('ResolveAI'),
  API_PORT: z.coerce.number().int().positive().default(4000),
  WEB_PORT: z.coerce.number().int().positive().default(3000),
  WORKER_PORT: z.coerce.number().int().nonnegative().default(4100),
  WORKER_CONCURRENCY: z.coerce.number().int().positive().max(20).default(2),
  WORKER_JOB_TIMEOUT_MS: z.coerce.number().int().positive().default(10 * 60 * 1000),
  WEB_URL: z.string().url().default('http://localhost:3000'),
  API_URL: z.string().url().default('http://localhost:4000/api/v1'),
  PUBLIC_API_URL: z.string().url().default('http://localhost:4000/api/v1'),
  NEXT_PUBLIC_API_URL: z.string().url().default('http://localhost:4000/api/v1'),
  WIDGET_SCRIPT_URL: z.string().url().default('http://localhost:3000/widget.js'),
  CORS_ALLOWED_ORIGINS: z.string().default('http://localhost:3000'),
  DATABASE_URL: z.string().min(1),
  DIRECT_DATABASE_URL: z.string().min(1).optional(),
  REDIS_URL: z.string().url(),
  JWT_ACCESS_SECRET: z.string().min(32),
  JWT_REFRESH_SECRET: z.string().min(32),
  JWT_ACCESS_TTL: z.string().default('15m'),
  JWT_REFRESH_TTL: z.string().default('30d'),
  COOKIE_DOMAIN: z.string().optional(),
  COOKIE_SECURE: z.preprocess((value) => value === undefined ? undefined : value === true || value === 'true', z.boolean().default(false)),
  COOKIE_SAME_SITE: z.enum(['lax', 'strict', 'none']).default('lax'),
  STORAGE_PROVIDER: z.enum(['local', 's3']).default('local'),
  KNOWLEDGE_STORAGE_DIR: z.string().default('storage'),
  KNOWLEDGE_MAX_FILE_SIZE_BYTES: z.coerce.number().int().positive().max(100 * 1024 * 1024).default(10 * 1024 * 1024),
  S3_ENDPOINT: z.string().url().optional(),
  S3_REGION: z.string().optional(),
  S3_BUCKET: z.string().optional(),
  S3_ACCESS_KEY_ID: z.string().optional(),
  S3_SECRET_ACCESS_KEY: z.string().optional(),
  BILLING_PROVIDER: z.enum(['mock', 'stripe']).default('mock'),
  STRIPE_SECRET_KEY: z.string().optional(),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),
  EMAIL_PROVIDER: z.enum(['console', 'smtp']).default('console'),
  EMAIL_FROM_NAME: z.string().default('ResolveAI'),
  EMAIL_FROM_ADDRESS: z.string().email().default('no-reply@example.com'),
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().int().positive().optional(),
  SMTP_USER: z.string().optional(),
  SMTP_PASSWORD: z.string().optional(),
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
  SENTRY_DSN: z.string().url().optional(),
  RELEASE: z.string().optional(),
  TRUST_PROXY: z.coerce.number().int().nonnegative().default(0),
  AUTH_RATE_LIMIT_MAX: z.coerce.number().int().positive().default(10),
  AUTH_RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(60_000),
  PUBLIC_RATE_LIMIT_MAX: z.coerce.number().int().positive().default(60),
  PUBLIC_RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(60_000),
  API_BODY_LIMIT: z.string().default('2mb'),
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
  AI_MINIMUM_SCORE: z.coerce.number().min(0).max(1).default(0.4),
});
export type GenerationEnv = z.infer<typeof generationEnvSchema>;
export const loadGenerationEnv = (input: Record<string, string | undefined>): GenerationEnv => generationEnvSchema.parse(input);
export type AIEnvironment = EmbeddingEnv & GenerationEnv & { EMBEDDING_BATCH_SIZE: number };
export const loadAIEnv = (input: Record<string, string | undefined>): AIEnvironment => ({ ...loadEmbeddingEnv(input), ...loadGenerationEnv(input) });
export type Env = z.infer<typeof envSchema>;
export const loadEnv = (input: Record<string, string | undefined>): Env => envSchema.parse(input);

export type RuntimeEnv = Env & GenerationEnv & EmbeddingEnv;

const isLocalUrl = (value: string): boolean => {
  try {
    const url = new URL(value);
    return ['localhost', '127.0.0.1'].includes(url.hostname);
  } catch {
    return false;
  }
};

export const validateRuntimeEnv = (input: Record<string, string | undefined>): RuntimeEnv => {
  const env = loadEnv(input);
  const ai = loadAIEnv(input);
  if (env.NODE_ENV !== 'production') return { ...env, ...ai };
  const errors: string[] = [];
  if (env.JWT_ACCESS_SECRET.includes('replace-with') || env.JWT_REFRESH_SECRET.includes('replace-with')) errors.push('JWT secrets must be replaced with strong production values');
  if (env.JWT_ACCESS_SECRET === env.JWT_REFRESH_SECRET) errors.push('JWT access and refresh secrets must differ');
  if (!ai.OPENAI_API_KEY) errors.push('OPENAI_API_KEY is required in production');
  for (const [name, value] of [['WEB_URL', env.WEB_URL], ['API_URL', env.API_URL], ['PUBLIC_API_URL', env.PUBLIC_API_URL], ['NEXT_PUBLIC_API_URL', env.NEXT_PUBLIC_API_URL], ['WIDGET_SCRIPT_URL', env.WIDGET_SCRIPT_URL]] as const) {
    if (isLocalUrl(value)) errors.push(`${name} must not use localhost in production`);
    if (!value.startsWith('https://')) errors.push(`${name} must use HTTPS in production`);
  }
  if (!env.COOKIE_SECURE) errors.push('COOKIE_SECURE must be true in production');
  if (env.COOKIE_SAME_SITE === 'none' && !env.COOKIE_SECURE) errors.push('COOKIE_SAME_SITE=none requires secure cookies');
  for (const origin of env.CORS_ALLOWED_ORIGINS.split(',').map((value) => value.trim()).filter(Boolean)) {
    try {
      const parsed = new URL(origin);
      if (parsed.protocol !== 'https:' || parsed.pathname !== '/' || parsed.search || parsed.hash) errors.push('CORS_ALLOWED_ORIGINS must contain exact HTTPS origins');
    } catch { errors.push('CORS_ALLOWED_ORIGINS contains an invalid origin'); }
  }
  if (env.STORAGE_PROVIDER === 's3' && (!env.S3_BUCKET || !env.S3_REGION || !env.S3_ACCESS_KEY_ID || !env.S3_SECRET_ACCESS_KEY)) errors.push('S3 storage requires bucket, region, access key, and secret key configuration');
  if (env.BILLING_PROVIDER === 'stripe' && !env.STRIPE_SECRET_KEY) errors.push('Stripe billing requires STRIPE_SECRET_KEY');
  if (env.EMAIL_PROVIDER === 'smtp' && (!env.SMTP_HOST || !env.SMTP_PORT)) errors.push('SMTP email requires SMTP_HOST and SMTP_PORT');
  if (errors.length > 0) throw new Error(`Production environment validation failed: ${errors.join('; ')}`);
  return { ...env, ...ai };
};

export function loadRootEnv(): string {
  const envFilePath = resolve(__dirname, '../../../.env');
  loadDotenv({ path: envFilePath, override: false });
  if (process.env.NODE_ENV !== 'production') {
    console.info(JSON.stringify({ event: 'environment.loaded', cwd: process.cwd(), envFilePath, databaseUrlConfigured: Boolean(process.env.DATABASE_URL), nodeEnv: process.env.NODE_ENV ?? 'undefined' }));
  }
  return envFilePath;
}
