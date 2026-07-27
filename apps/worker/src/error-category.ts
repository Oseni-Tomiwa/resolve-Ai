export function processingErrorCategory(error: unknown): string {
  const candidate = error as { code?: string; status?: number };
  const message = error instanceof Error ? error.message.toLowerCase() : '';

  if (message.includes('openai_api_key') && message.includes('not configured')) return 'MISSING_API_KEY';
  if (candidate.status === 401 || candidate.code === 'invalid_api_key' || message.includes('incorrect api key')) return 'INVALID_API_KEY';
  if (candidate.status === 429 || message.includes('insufficient_quota') || message.includes('rate limit')) return 'PROVIDER_LIMIT';
  if (message.includes('timeout') || message.includes('etimedout') || message.includes('econnaborted')) return 'PROVIDER_TIMEOUT';
  if (message.includes('redis') || message.includes('econnrefused')) return 'REDIS_UNAVAILABLE';
  if (message.includes('prisma') || message.includes('database') || message.includes('connection')) return 'DATABASE_UNAVAILABLE';
  if (message.includes('extract') || message.includes('readable text')) return 'EXTRACTION_FAILED';
  if (message.includes('embedding')) return 'EMBEDDING_FAILED';
  return 'PROCESSING_FAILED';
}
