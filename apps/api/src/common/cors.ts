export const corsAllowedHeaders = 'Content-Type, Authorization, X-Request-Id';

export function isAllowedCorsOrigin(origin: string | undefined, configuredOrigins: string, isPublicWidget = false): boolean {
  if (!origin) return false;
  if (isPublicWidget) return true;
  return new Set(configuredOrigins.split(',').map((value) => value.trim()).filter(Boolean)).has(origin);
}
