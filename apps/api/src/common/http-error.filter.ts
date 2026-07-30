import { Catch, HttpException, type ArgumentsHost, type ExceptionFilter } from '@nestjs/common';
import type { Request, Response } from 'express';

type ErrorBody = { statusCode?: number; message?: string | string[]; error?: string; code?: string };

const codeForStatus = (status: number): string => ({ 400: 'VALIDATION_ERROR', 401: 'UNAUTHORIZED', 403: 'FORBIDDEN', 404: 'NOT_FOUND', 409: 'CONFLICT', 429: 'RATE_LIMITED', 503: 'SERVICE_UNAVAILABLE' }[status] ?? 'INTERNAL_ERROR');

@Catch()
export class HttpErrorFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const context = host.switchToHttp();
    const request = context.getRequest<Request & { id?: string }>();
    const response = context.getResponse<Response>();
    const requestId = request.id ?? request.headers['x-request-id'] ?? 'unknown';
    const status = exception instanceof HttpException ? exception.getStatus() : 500;
    const raw = exception instanceof HttpException ? exception.getResponse() : null;
    const body = typeof raw === 'object' && raw !== null ? raw as ErrorBody : { message: typeof raw === 'string' ? raw : undefined };
    const message = Array.isArray(body.message) ? body.message.join('; ') : body.message ?? (status >= 500 ? 'The server could not complete the request.' : 'The request could not be completed.');
    const code = body.code ?? codeForStatus(status);
    if (status >= 500) console.error(JSON.stringify({ event: 'http.request_failed', requestId, method: request.method, route: request.path, status, code }));
    response.status(status).json({ success: false, message, error: { code, requestId, details: Array.isArray(body.message) ? body.message : [] } });
  }
}
