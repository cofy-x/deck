/**
 * @license
 * Copyright 2026 cofy-x
 * SPDX-License-Identifier: Apache-2.0
 */

import type { Logger } from 'pino';

import type { RunState } from '../../types/index.js';

export class SessionRunRegistry {
  private readonly activeRuns = new Map<string, RunState>();
  private readonly sessionQueue = new Map<string, Promise<void>>();

  constructor(private readonly logger: Logger) {}

  getActiveRuns(): Map<string, RunState> {
    return this.activeRuns;
  }

  get(sessionID: string): RunState | undefined {
    return this.activeRuns.get(sessionID);
  }

  set(run: RunState): void {
    this.activeRuns.set(run.sessionID, run);
  }

  delete(sessionID: string): void {
    this.activeRuns.delete(sessionID);
  }

  enqueue(sessionID: string, task: () => Promise<void>): void {
    const previous = this.sessionQueue.get(sessionID) ?? Promise.resolve();
    const next = previous
      .then(task)
      .catch((error) => {
        this.logger.error({ error, sessionID }, 'session task failed');
      })
      .finally(() => {
        if (this.sessionQueue.get(sessionID) === next) {
          this.sessionQueue.delete(sessionID);
        }
      });
    this.sessionQueue.set(sessionID, next);
  }

  getPendingTask(sessionID: string): Promise<void> | undefined {
    return this.sessionQueue.get(sessionID);
  }
}
