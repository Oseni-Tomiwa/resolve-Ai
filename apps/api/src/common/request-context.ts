import { randomUUID } from 'node:crypto';
import { isValidRequestId } from '@resolveai/shared';
import type { Request } from 'express';
export type RequestWithContext = Request & { id?: string };
export function requestIdFrom(request: Request): string { const value = request.headers['x-request-id']; const candidate = typeof value === 'string' ? value : undefined; return isValidRequestId(candidate) ? candidate : randomUUID(); }
