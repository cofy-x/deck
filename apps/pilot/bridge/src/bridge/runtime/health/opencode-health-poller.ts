/**
 * @license
 * Copyright 2026 cofy-x
 * SPDX-License-Identifier: Apache-2.0
 */

import type { Logger } from 'pino';

import type { OpencodeClient } from '../../../opencode.js';

export interface OpencodeHealthState {
  healthy: boolean;
  version?: string;
}

export class OpencodeHealthPoller {
  private state: OpencodeHealthState = {
    healthy: false,
  };

  constructor(
    private readonly client: OpencodeClient,
    private readonly logger: Logger,
  ) {}

  async refresh(): Promise<void> {
    try {
      const { data: health } = await this.client.global.health<true>();
      this.state.healthy = Boolean(health.healthy);
      this.state.version = health.version;
    } catch (error) {
      this.logger.warn({ error }, 'failed to reach opencode health');
      this.state.healthy = false;
    }
  }

  snapshot(): OpencodeHealthState {
    return this.state;
  }
}
