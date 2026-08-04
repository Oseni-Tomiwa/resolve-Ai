import 'reflect-metadata';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { ValidationPipe } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { loadRootEnv, validateRuntimeEnv } from '@resolveai/config';
import { writeSafeLog } from '@resolveai/shared';
import { AppModule } from './app.module';
import { HttpErrorFilter } from './common/http-error.filter';
import { corsAllowedHeaders, isAllowedCorsOrigin } from './common/cors';
import { requestIdFrom } from './common/request-context';
import { MetricsService } from './common/metrics.service';
import { MonitoringService } from './common/monitoring.service';

async function bootstrap(): Promise<void> {
  loadRootEnv();
  const env = validateRuntimeEnv(process.env);
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { bufferLogs: true, rawBody: true });
  const metrics = app.get(MetricsService);
  app.getHttpAdapter().getInstance().set('trust proxy', env.TRUST_PROXY);
  app.setGlobalPrefix('api/v1');
  app.useBodyParser('json', { limit: env.API_BODY_LIMIT });
  app.useBodyParser('urlencoded', { extended: true, limit: env.API_BODY_LIMIT });
  app.use((request: Request & { id?: string }, response: Response, next: NextFunction) => {
    request.id = requestIdFrom(request);
    response.setHeader('X-Request-Id', request.id);
    const startedAt = Date.now();
    response.once('finish', () => {
      const durationMs = Date.now() - startedAt;
      metrics.increment(response.statusCode >= 500 ? 'http.errors' : 'http.requests', durationMs);
      writeSafeLog({ service: env.APP_NAME.toLowerCase().replace(/\s+/g, '-'), environment: env.NODE_ENV, event: 'http.request', requestId: request.id, method: request.method, route: request.path, statusCode: response.statusCode, durationMs });
    });
    next();
  });
  // Keep authenticated dashboard CORS restricted while allowing public widget
  // responses to reach the browser, where WidgetService performs the exact
  // configured-domain authorization check.
  app.use((request: Request, response: Response, next: NextFunction) => {
    const origin = request.headers.origin;
    const isPublicWidget = request.path.startsWith('/api/v1/public/widgets');
    if (origin && isAllowedCorsOrigin(origin, env.CORS_ALLOWED_ORIGINS, isPublicWidget)) {
      response.setHeader('Access-Control-Allow-Origin', origin);
      response.setHeader('Access-Control-Allow-Credentials', 'true');
      response.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
      response.setHeader('Access-Control-Allow-Headers', corsAllowedHeaders);
      response.setHeader('Vary', 'Origin');
      if (request.method === 'OPTIONS') {
        response.status(204).end();
        return;
      }
    }
    next();
  });
  app.use(helmet({ contentSecurityPolicy: env.NODE_ENV === 'production' ? undefined : false }));
  app.use((request: Request & { id?: string }, response: Response, next: NextFunction) => {
    response.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
    const origin = request.headers.origin;
    const isMutation = !['GET', 'HEAD', 'OPTIONS'].includes(request.method);
    const isPublicWidget = request.path.startsWith('/api/v1/public/widgets');
    if (isMutation && request.headers.cookie && origin && !isPublicWidget && !isAllowedCorsOrigin(origin, env.CORS_ALLOWED_ORIGINS, false)) {
      response.status(403).json({ success: false, message: 'Request origin is not allowed.', error: { code: 'CSRF_ORIGIN_DENIED', requestId: request.id ?? 'unknown', details: [] } });
      return;
    }
    next();
  });
  app.use(cookieParser());
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
  app.useGlobalFilters(new HttpErrorFilter(app.get(MonitoringService)));
  const config = new DocumentBuilder().setTitle('ResolveAI API').setDescription('ResolveAI platform API').setVersion('1.0').addBearerAuth().build();
  SwaggerModule.setup('docs', app, SwaggerModule.createDocument(app, config));
  app.enableShutdownHooks();
  const httpAdapter = app.getHttpAdapter();
  const registerNotFoundHandler = httpAdapter.setNotFoundHandler?.bind(httpAdapter);
  if (registerNotFoundHandler) httpAdapter.setNotFoundHandler = () => registerNotFoundHandler((request: Request & { id?: string }, response: Response) => response.status(404).json({ success: false, message: 'The requested API route was not found.', error: { code: 'NOT_FOUND', requestId: request.id ?? 'unknown', details: [] } }));
  await app.init();
  await app.listen(env.API_PORT);
}
void bootstrap();
