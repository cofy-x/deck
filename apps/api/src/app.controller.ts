/**
 * @license
 * Copyright 2026 cofy-x
 * SPDX-License-Identifier: Apache-2.0
 */

import { Controller, Get, Inject, Logger } from '@nestjs/common';
import { sql } from 'drizzle-orm';
import { Redis } from 'ioredis';
import {
  DB_CONNECTION,
  type DrizzleDB,
} from './common/database/database.module.js';
import { REDIS_CLIENT } from './common/redis/redis.module.js';

interface HealthStatus {
  status: 'ok' | 'degraded' | 'unhealthy';
  timestamp: string;
  services: {
    database: boolean;
    redis: boolean;
  };
}

@Controller()
export class AppController {
  private readonly logger = new Logger(AppController.name);

  constructor(
    @Inject(DB_CONNECTION) private readonly db: DrizzleDB,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
  ) {}

  /**
   * Health check endpoint
   * Checks connectivity to database, Redis, and runners
   */
  @Get('health')
  async health(): Promise<HealthStatus> {
    const timestamp = new Date().toISOString();

    // Check database connectivity
    let dbHealthy = false;
    try {
      await this.db.execute(sql`SELECT 1`);
      dbHealthy = true;
    } catch (error) {
      this.logger.error('Database health check failed', error);
    }

    // Check Redis connectivity
    let redisHealthy = false;
    try {
      await this.redis.ping();
      redisHealthy = true;
    } catch (error) {
      this.logger.error('Redis health check failed', error);
    }

    // Determine overall status
    const allHealthy = dbHealthy && redisHealthy;
    const anyHealthy = dbHealthy || redisHealthy;

    let status: HealthStatus['status'] = 'ok';
    if (!allHealthy) {
      status = anyHealthy ? 'degraded' : 'unhealthy';
    }

    return {
      status,
      timestamp,
      services: {
        database: dbHealthy,
        redis: redisHealthy,
      },
    };
  }

  /**
   * Simple liveness probe
   */
  @Get()
  root() {
    return { status: 'ok', service: 'deck-api' };
  }
}
