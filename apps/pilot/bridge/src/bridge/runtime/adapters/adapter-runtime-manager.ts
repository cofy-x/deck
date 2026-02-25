/**
 * @license
 * Copyright 2026 cofy-x
 * SPDX-License-Identifier: Apache-2.0
 */

import type { Logger } from 'pino';

import {
  ADAPTER_REGISTRY,
  createSlackAdapter,
  createTelegramAdapter,
} from '../../../adapters/index.js';
import type { AdapterRegistration } from '../../../adapters/index.js';
import type {
  Adapter,
  BridgeReporter,
  ChannelName,
  Config,
  MessageHandler,
} from '../../../types/index.js';
import { CHANNEL_LABELS } from '../../support/constants.js';

export interface AdapterReloadCreators {
  telegram: (
    config: Config,
    logger: Logger,
    onInbound: MessageHandler,
  ) => Adapter;
  slack: (
    config: Config,
    logger: Logger,
    onInbound: MessageHandler,
  ) => Adapter;
}

const DEFAULT_ADAPTER_RELOAD_CREATORS: AdapterReloadCreators = {
  telegram: createTelegramAdapter,
  slack: createSlackAdapter,
};

export interface AdapterRuntimeManagerDeps {
  config: Config;
  logger: Logger;
  onInbound: MessageHandler;
  reporter?: BridgeReporter;
  adapters?: Map<ChannelName, Adapter>;
  adapterRegistry?: AdapterRegistration[];
  adapterReloadCreators?: Partial<AdapterReloadCreators>;
}

export class AdapterRuntimeManager {
  private readonly adapters: Map<ChannelName, Adapter>;

  private readonly usingInjectedAdapters: boolean;

  private readonly adapterRegistry: AdapterRegistration[];

  private readonly adapterReloadCreators: AdapterReloadCreators;

  constructor(private readonly deps: AdapterRuntimeManagerDeps) {
    this.adapters = deps.adapters ?? new Map<ChannelName, Adapter>();
    this.usingInjectedAdapters = Boolean(deps.adapters);
    this.adapterRegistry = deps.adapterRegistry ?? ADAPTER_REGISTRY;
    this.adapterReloadCreators = {
      ...DEFAULT_ADAPTER_RELOAD_CREATORS,
      ...deps.adapterReloadCreators,
    };
  }

  getAdapters(): Map<ChannelName, Adapter> {
    return this.adapters;
  }

  has(channel: ChannelName): boolean {
    return this.adapters.has(channel);
  }

  initialize(): void {
    if (this.usingInjectedAdapters) return;
    this.initializeAdaptersFromRegistry();
  }

  async startAll(): Promise<void> {
    const reportStatus = this.deps.reporter?.onStatus;
    for (const adapter of this.adapters.values()) {
      await adapter.start();
      reportStatus?.(`${CHANNEL_LABELS[adapter.name]} adapter started.`);
    }
  }

  async stopAll(): Promise<void> {
    for (const adapter of this.adapters.values()) {
      await adapter.stop();
    }
  }

  async reloadTelegramAdapter(): Promise<void> {
    await this.reloadAdapter(
      'telegram',
      'failed to stop existing telegram adapter',
      () =>
        this.adapterReloadCreators.telegram(
          this.deps.config,
          this.deps.logger,
          this.deps.onInbound,
        ),
    );
  }

  async reloadSlackAdapter(): Promise<void> {
    await this.reloadAdapter(
      'slack',
      'failed to stop existing slack adapter',
      () =>
        this.adapterReloadCreators.slack(
          this.deps.config,
          this.deps.logger,
          this.deps.onInbound,
        ),
    );
  }

  private initializeAdaptersFromRegistry(): void {
    const reportStatus = this.deps.reporter?.onStatus;
    for (const registration of this.adapterRegistry) {
      if (!registration.isEnabled(this.deps.config)) {
        this.deps.logger.info({ channel: registration.name }, 'adapter disabled');
        reportStatus?.(`${registration.label} adapter disabled.`);
        continue;
      }
      if (!registration.isConfigured(this.deps.config)) {
        this.deps.logger.warn(
          { channel: registration.name },
          'adapter enabled but not configured',
        );
        reportStatus?.(`${registration.label} adapter not configured.`);
        continue;
      }

      this.adapters.set(
        registration.name,
        registration.create(
          this.deps.config,
          this.deps.logger,
          this.deps.onInbound,
          this.deps.reporter,
        ),
      );
      this.deps.logger.debug({ channel: registration.name }, 'adapter enabled');
    }
  }

  private async reloadAdapter(
    channel: ChannelName,
    stopErrorLog: string,
    createAdapter: () => Adapter,
  ): Promise<void> {
    const existing = this.adapters.get(channel);
    if (existing) {
      try {
        await existing.stop();
      } catch (error) {
        this.deps.logger.warn({ error }, stopErrorLog);
      }
      this.adapters.delete(channel);
    }

    const next = createAdapter();
    this.adapters.set(channel, next);
    await next.start();
  }
}
