import { Injectable } from '@nestjs/common';
import { writeSafeLog } from '@resolveai/shared';
@Injectable()
export class MonitoringService { captureException(error: unknown, context: { requestId?: string; workspaceId?: string; route?: string; service?: string } = {}): void { writeSafeLog({ level: 'error', service: context.service ?? 'api', environment: process.env.NODE_ENV ?? 'development', event: 'monitoring.exception', requestId: context.requestId, workspaceId: context.workspaceId, route: context.route, errorCode: error instanceof Error ? error.name : 'UNKNOWN_ERROR', message: error instanceof Error ? error.message : 'Unexpected exception' }); } }
