import 'reflect-metadata';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import type { NextFunction, Request, Response } from 'express';
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  app.setGlobalPrefix('api/v1');
  // Keep authenticated dashboard CORS restricted while allowing public widget
  // responses to reach the browser, where WidgetService performs the exact
  // configured-domain authorization check.
  app.use((request: Request, response: Response, next: NextFunction) => {
    const origin = request.headers.origin;
    const isPublicWidget = request.path.startsWith('/api/v1/public/widgets');
    const developmentOrigins = new Set(['http://localhost:3000', 'http://localhost:3001']);
    const dashboardOrigin = process.env.NODE_ENV === 'production'
      ? process.env.WEB_URL
      : developmentOrigins.has(origin ?? '') ? origin : process.env.WEB_URL;
    if (origin && (isPublicWidget || origin === dashboardOrigin)) {
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
  const config = new DocumentBuilder().setTitle('ResolveAI API').setDescription('ResolveAI platform API').setVersion('1.0').addBearerAuth().build();
  SwaggerModule.setup('docs', app, SwaggerModule.createDocument(app, config));
  app.enableShutdownHooks();
  await app.listen(Number(process.env.API_PORT ?? 4000));
}
void bootstrap();
