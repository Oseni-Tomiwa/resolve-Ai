import 'reflect-metadata';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { randomUUID } from 'node:crypto';
import { ValidationPipe } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { loadRootEnv, validateRuntimeEnv } from '@resolveai/config';
import { AppModule } from './app.module';
import { HttpErrorFilter } from './common/http-error.filter';

async function bootstrap(): Promise<void> {
  loadRootEnv();
  const env = validateRuntimeEnv(process.env);
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { bufferLogs: true });
  app.getHttpAdapter().getInstance().set('trust proxy', env.TRUST_PROXY);
  app.setGlobalPrefix('api/v1');
  app.useBodyParser('json', { limit: env.API_BODY_LIMIT });
  app.useBodyParser('urlencoded', { extended: true, limit: env.API_BODY_LIMIT });
  app.use((request: Request & { id?: string }, response: Response, next: NextFunction) => {
    const supplied = request.headers['x-request-id'];
    request.id = typeof supplied === 'string' && /^[A-Za-z0-9._:-]{1,100}$/.test(supplied) ? supplied : randomUUID();
    response.setHeader('X-Request-Id', request.id);
    const startedAt = Date.now();
    response.once('finish', () => {
      const event = { event: 'http.request', service: env.APP_NAME.toLowerCase().replace(/\s+/g, '-'), environment: env.NODE_ENV, requestId: request.id, method: request.method, route: request.path, status: response.statusCode, latencyMs: Date.now() - startedAt };
      if (env.NODE_ENV === 'production') console.log(JSON.stringify(event));
      else console.info(`${event.method} ${event.route} ${event.status} ${event.latencyMs}ms [${event.requestId}]`);
    });
    next();
  });
  // Keep authenticated dashboard CORS restricted while allowing public widget
  // responses to reach the browser, where WidgetService performs the exact
  // configured-domain authorization check.
  app.use((request: Request, response: Response, next: NextFunction) => {
    const origin = request.headers.origin;
    const isPublicWidget = request.path.startsWith('/api/v1/public/widgets');
    const allowedOrigins = new Set(env.CORS_ALLOWED_ORIGINS.split(',').map((value) => value.trim()).filter(Boolean));
    if (origin && (isPublicWidget || allowedOrigins.has(origin))) {
      response.setHeader('Access-Control-Allow-Origin', origin);
      response.setHeader('Access-Control-Allow-Credentials', 'true');
      response.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
      response.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
      response.setHeader('Vary', 'Origin');
      if (request.method === 'OPTIONS') {
        response.status(204).end();
        return;
      }
    }
    next();
  });
  app.use(helmet());
  app.use(cookieParser());
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
  app.useGlobalFilters(new HttpErrorFilter());
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
