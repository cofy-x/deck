/**
 * @license
 * Copyright 2026 cofy-x
 * SPDX-License-Identifier: Apache-2.0
 */

import type { ChildProcess } from 'node:child_process';

import type { ChildHandle, Logger } from '../types/index.js';
import { stopChild } from '../utils/process.js';

export interface ExitDetails {
  reason: string;
  code: number | null;
  signal: NodeJS.Signals | null;
}

export function describeExit(
  code: number | null,
  signal: NodeJS.Signals | null,
): ExitDetails {
  const reason =
    code !== null ? `code ${code}` : signal ? `signal ${signal}` : 'unknown';
  return { reason, code, signal };
}

export class StartLifecycleManager {
  private readonly children: ChildHandle[] = [];
  private readonly intervals = new Set<ReturnType<typeof setInterval>>();
  private shuttingDown = false;
  private detached = false;

  constructor(private readonly logger: Logger) {}

  get isShuttingDown(): boolean {
    return this.shuttingDown;
  }

  get isDetached(): boolean {
    return this.detached;
  }

  get handles(): readonly ChildHandle[] {
    return this.children;
  }

  register(name: string, child: ChildProcess): void {
    this.children.push({ name, child });
  }

  trackInterval(interval: ReturnType<typeof setInterval>): void {
    this.intervals.add(interval);
  }

  clearIntervals(): void {
    for (const interval of this.intervals) {
      clearInterval(interval);
    }
    this.intervals.clear();
  }

  async shutdown(): Promise<void> {
    if (this.shuttingDown) return;
    this.shuttingDown = true;
    this.clearIntervals();
    this.logger.info(
      'Shutting down',
      { children: this.children.map((entry) => entry.name).join(',') },
      'pilot',
    );
    await Promise.all(this.children.map((entry) => stopChild(entry.child)));
  }

  detach(): void {
    if (this.detached) return;
    this.detached = true;
    this.clearIntervals();
    for (const handle of this.children) {
      try {
        handle.child.unref();
      } catch {
        // ignore detach errors
      }
      handle.child.stdout?.removeAllListeners();
      handle.child.stderr?.removeAllListeners();
      handle.child.stdout?.destroy();
      handle.child.stderr?.destroy();
    }
  }
}
