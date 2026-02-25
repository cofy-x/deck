/**
 * @license
 * Copyright 2025 cofy-x
 * SPDX-License-Identifier: Apache-2.0
 */
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { LoggerModule } from 'nestjs-pino';
import { APP_PIPE } from '@nestjs/core';
import { ZodValidationPipe } from 'nestjs-zod';
import { BullModule } from '@nestjs/bullmq';

import { DatabaseModule } from './common/database/database.module.js';
import { RedisModule } from './common/redis/redis.module.js';
import { ExampleModule } from './modules/example/example.module.js';
import { AppController } from './app.controller.js';

@Module({
  imports: [
    // 1. Environment variables
    ConfigModule.forRoot({ isGlobal: true }),

    // 2. Logger (Pino)
    LoggerModule.forRoot({
      pinoHttp: {
        transport:
          process.env['NODE_ENV'] !== 'production'
            ? { target: 'pino-pretty' }
            : undefined,
      },
    }),

    // 3. Redis & BullMQ configuration
    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        connection: {
          host: config.get('REDIS_HOST'),
          port: config.get('REDIS_PORT'),
        },
      }),
    }),

    // 4. Infrastructure modules
    DatabaseModule,
    RedisModule,

    // 5. Business modules
    ExampleModule,
  ],
  controllers: [AppController],
  providers: [
    {
      provide: APP_PIPE,
      useClass: ZodValidationPipe, // Global Zod validation pipe
    },
  ],
})
export class AppModule {}
