export const ORGANIZATION_ROLES = ['OWNER', 'ADMIN', 'MEMBER'] as const;
export const WORKSPACE_ROLES = ['ADMIN', 'AGENT', 'VIEWER'] as const;
export type OrganizationRole = (typeof ORGANIZATION_ROLES)[number];
export type WorkspaceRole = (typeof WORKSPACE_ROLES)[number];
export type ApiSuccess<T> = { success: true; message: string; data: T };
export type ApiFailure = { success: false; message: string; error: { code: string; details: readonly unknown[] } };
export type ApiResponse<T> = ApiSuccess<T> | ApiFailure;

export type SafeLogLevel = 'debug' | 'info' | 'warn' | 'error';
export type SafeLogEvent = { level?: SafeLogLevel; service: string; environment?: string; event: string; requestId?: string; userId?: string; organizationId?: string; workspaceId?: string; route?: string; method?: string; statusCode?: number; durationMs?: number; errorCode?: string; message?: string; [key: string]: unknown };
export function writeSafeLog(event: SafeLogEvent): void { const safe = Object.fromEntries(Object.entries(event).filter(([key, value]) => { if (['password','passwordHash','token','accessToken','refreshToken','cookie','authorization','secret','apiKey','content','body'].some((part) => key.toLowerCase().includes(part))) return false; return value !== undefined && !(typeof value === 'string' && value.length > 500); })); const line = JSON.stringify({ timestamp: new Date().toISOString(), ...safe }); const level = event.level ?? 'info'; if (level === 'error') console.error(line); else if (level === 'warn') console.warn(line); else if (level === 'debug') console.debug(line); else console.info(line); }
export function isValidRequestId(value: unknown): value is string { return typeof value === 'string' && /^[A-Za-z0-9._:-]{1,100}$/.test(value); }
