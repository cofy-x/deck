/**
 * @license
 * Copyright 2025 cofy-x
 * SPDX-License-Identifier: Apache-2.0
 */

import { NestFactory } from '@nestjs/core';
import {
  FastifyAdapter,
  type NestFastifyApplication,
} from '@nestjs/platform-fastify';
import { Logger } from 'nestjs-pino';
import { AppModule } from './app.module.js';
import { CORE_VERSION } from '@cofy-x/deck-core-ts';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { cleanupOpenApiDoc } from 'nestjs-zod';

async function bootstrap() {
  // Use Fastify adapter
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter(),
    { bufferLogs: true }, // Buffer logs until Pino is initialized
  );

  app.enableShutdownHooks();

  // Use nestjs-pino to handle system logs
  app.useLogger(app.get(Logger));

  // Enable CORS with full configuration
  app.enableCors({
    origin: true, // Allow all origins in development
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept'],
    credentials: true,
  });

  // Configure Swagger
  const config = new DocumentBuilder()
    .setTitle('Deck API')
    .setDescription('The AI Code Infrastructure API')
    .setVersion('1.0')
    .build();

  const openApiDoc = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/doc', app, cleanupOpenApiDoc(openApiDoc));

  // Listen on port 3001, set Host to 0.0.0.0 for container/LAN access
  await app.listen(3001, '0.0.0.0');

  const logger = app.get(Logger);
  logger.log(
    `Application is running on: ${await app.getUrl()}, version: ${CORE_VERSION}`,
  );
  logger.log(`Swagger UI available at: ${await app.getUrl()}/api/doc`);
}

bootstrap().catch((err) => {
  console.error(err);
  process.exit(1);
});
