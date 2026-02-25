/**
 * @license
 * Copyright 2026 cofy-x
 * SPDX-License-Identifier: Apache-2.0
 */
import { Module, Global } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Redis } from 'ioredis';
import { REDIS_CLIENT } from './constants.js';

// Re-export for backward compatibility
export { REDIS_CLIENT } from './constants.js';

/**
 * RedisModule provides Redis client and RouterService globally.
 *
 * - REDIS_CLIENT: ioredis client for direct Redis operations
 * - RouterService: Sandbox location resolution via Redis
 */
@Global()
@Module({
  providers: [
    {
      provide: REDIS_CLIENT,
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const host = config.get<string>('REDIS_HOST', 'localhost');
        const port = config.get<number>('REDIS_PORT', 6379);
        const password = config.get<string>('REDIS_PASSWORD');

        return new Redis({
          host,
          port,
          password: password || undefined,
          lazyConnect: true,
        });
      },
    },
  ],
  exports: [REDIS_CLIENT],
})
export class RedisModule {}
