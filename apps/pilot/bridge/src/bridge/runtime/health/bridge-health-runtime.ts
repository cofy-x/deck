/**
 * @license
 * Copyright 2026 cofy-x
 * SPDX-License-Identifier: Apache-2.0
 */

import type { Logger } from 'pino';

import { startHealthServer } from '../../../health.js';
import type { OpencodeClient } from '../../../opencode.js';
import type {
  Adapter,
  ChannelName,
  Config,
  HealthHandlers,
  HealthSnapshot,
} from '../../../types/index.js';
import type { AdapterRuntimeManager } from '../adapters/adapter-runtime-manager.js';
import {
  createHealthHandlers,
  type HealthHandlersFactoryInput,
} from './health-handlers-factory.js';
import {
  HealthConfigStore,
  type HealthConfigStoreLike,
} from './health-config-store.js';
import {
  buildHealthSnapshot,
  type BuildHealthSnapshotInput,
} from './health-snapshot-builder.js';
import { OpencodeHealthPoller } from './opencode-health-poller.js';

interface TimerApi {
  setInterval(handler: () => void, timeoutMs: number): NodeJS.Timeout;
  clearInterval(timeout: NodeJS.Timeout): void;
}

const DEFAULT_TIMER_API: TimerApi = {
  setInterval: (handler, timeoutMs) => setInterval(handler, timeoutMs),
  clearInterval: (timeout) => clearInterval(timeout),
};

export interface BridgeHealthRuntimeDeps {
  config: Config;
  logger: Logger;
  client: OpencodeClient;
  adapters: Map<ChannelName, Adapter>;
  adapterManager: AdapterRuntimeManager;
  disableHealthServer?: boolean;
  healthIntervalMs?: number;
  startHealthServerFn?: typeof startHealthServer;
  timerApi?: TimerApi;
  configStore?: HealthConfigStoreLike;
  createHandlersFn?: (input: HealthHandlersFactoryInput) => HealthHandlers;
  buildSnapshotFn?: (input: BuildHealthSnapshotInput) => HealthSnapshot;
}

export class BridgeHealthRuntime {
  private groupsEnabled: boolean;

  private healthTimer: NodeJS.Timeout | null = null;

  private stopHealthServer: (() => void) | null = null;

  private readonly timerApi: TimerApi;

  private readonly healthIntervalMs: number;

  private readonly configStore: HealthConfigStoreLike;

  private readonly createHandlersFn: (
    input: HealthHandlersFactoryInput,
  ) => HealthHandlers;

  private readonly buildSnapshotFn: (
    input: BuildHealthSnapshotInput,
  ) => HealthSnapshot;

  private readonly healthPoller: OpencodeHealthPoller;

  constructor(private readonly deps: BridgeHealthRuntimeDeps) {
    this.groupsEnabled = deps.config.groupsEnabled;
    this.timerApi = deps.timerApi ?? DEFAULT_TIMER_API;
    this.healthIntervalMs = deps.healthIntervalMs ?? 30_000;
    this.configStore = deps.configStore ?? new HealthConfigStore(deps.config);
    this.createHandlersFn = deps.createHandlersFn ?? createHealthHandlers;
    this.buildSnapshotFn = deps.buildSnapshotFn ?? buildHealthSnapshot;
    this.healthPoller = new OpencodeHealthPoller(deps.client, deps.logger);
  }

  async start(): Promise<void> {
    await this.healthPoller.refresh();
    this.healthTimer = this.timerApi.setInterval(() => {
      void this.healthPoller.refresh();
    }, this.healthIntervalMs);

    if (this.deps.disableHealthServer) {
      return;
    }

    this.stopHealthServer = this.startServer();
  }

  stop(): void {
    if (this.healthTimer) {
      this.timerApi.clearInterval(this.healthTimer);
      this.healthTimer = null;
    }
    if (this.stopHealthServer) {
      this.stopHealthServer();
      this.stopHealthServer = null;
    }
  }

  private startServer(): (() => void) | null {
    if (!this.deps.config.healthPort) {
      return null;
    }

    const handlers = this.createHandlersFn({
      config: this.deps.config,
      logger: this.deps.logger,
      configStore: this.configStore,
      adapterManager: this.deps.adapterManager,
      groupsState: {
        get: () => this.groupsEnabled,
        set: (value: boolean) => {
          this.groupsEnabled = value;
        },
      },
    });
    const startHealthServerFn = this.deps.startHealthServerFn ?? startHealthServer;

    return startHealthServerFn(
      this.deps.config.healthPort,
      () =>
        this.buildSnapshotFn({
          config: this.deps.config,
          adapters: this.deps.adapters,
          opencodeHealthy: this.healthPoller.snapshot().healthy,
          opencodeVersion: this.healthPoller.snapshot().version,
          groupsEnabled: this.groupsEnabled,
        }),
      this.deps.logger,
      handlers,
    );
  }
}
