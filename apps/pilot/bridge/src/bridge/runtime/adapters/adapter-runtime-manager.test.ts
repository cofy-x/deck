/**
 * @license
 * Copyright 2026 cofy-x
 * SPDX-License-Identifier: Apache-2.0
 */

import pino from 'pino';
import { describe, expect, test, vi } from 'vitest';

import type { AdapterRegistration } from '../../../adapters/index.js';
import type {
  Adapter,
  BridgeReporter,
  ChannelName,
  Config,
  MessageHandler,
} from '../../../types/index.js';
import { AdapterRuntimeManager } from './adapter-runtime-manager.js';

function createAdapter(name: Adapter['name']): Adapter {
  return {
    name,
    maxTextLength: 4000,
    capabilities: {
      progress: false,
      typing: false,
      file: false,
    },
    start: vi.fn(async () => undefined),
    stop: vi.fn(async () => undefined),
    sendText: vi.fn(async () => undefined),
  };
}

describe('AdapterRuntimeManager', () => {
  test('initialize registers only enabled and configured adapters', () => {
    const config = {} as unknown as Config;
    const logger = pino({ enabled: false });
    const onInbound = vi.fn<MessageHandler>(async () => undefined);
    const onStatus = vi.fn();
    const reporter: BridgeReporter = { onStatus };

    const enabledConfigured = createAdapter('telegram');
    const registry: AdapterRegistration[] = [
      {
        name: 'telegram',
        label: 'Telegram',
        isEnabled: () => true,
        isConfigured: () => true,
        create: () => enabledConfigured,
      },
      {
        name: 'slack',
        label: 'Slack',
        isEnabled: () => false,
        isConfigured: () => true,
        create: () => createAdapter('slack'),
      },
      {
        name: 'discord',
        label: 'Discord',
        isEnabled: () => true,
        isConfigured: () => false,
        create: () => createAdapter('discord'),
      },
    ];

    const manager = new AdapterRuntimeManager({
      config,
      logger,
      onInbound,
      reporter,
      adapterRegistry: registry,
    });

    manager.initialize();

    expect(manager.getAdapters().size).toBe(1);
    expect(manager.getAdapters().get('telegram')).toBe(enabledConfigured);
    expect(onStatus).toHaveBeenCalledWith('Slack adapter disabled.');
    expect(onStatus).toHaveBeenCalledWith('Discord adapter not configured.');
  });

  test('reloadTelegramAdapter replaces existing adapter and starts new one', async () => {
    const config = {} as unknown as Config;
    const logger = pino({ enabled: false });
    const onInbound = vi.fn<MessageHandler>(async () => undefined);
    const existing = createAdapter('telegram');
    const next = createAdapter('telegram');
    const adapters = new Map<ChannelName, Adapter>([['telegram', existing]]);

    const manager = new AdapterRuntimeManager({
      config,
      logger,
      onInbound,
      adapters,
      adapterReloadCreators: {
        telegram: () => next,
      },
    });

    await manager.reloadTelegramAdapter();

    expect(existing.stop).toHaveBeenCalledTimes(1);
    expect(next.start).toHaveBeenCalledTimes(1);
    expect(manager.getAdapters().get('telegram')).toBe(next);
  });

  test('reloadSlackAdapter continues when stop of existing adapter fails', async () => {
    const config = {} as unknown as Config;
    const logger = pino({ enabled: false });
    const warnSpy = vi.spyOn(logger, 'warn');
    const onInbound = vi.fn<MessageHandler>(async () => undefined);
    const existing = createAdapter('slack');
    existing.stop = vi.fn(async () => {
      throw new Error('stop failed');
    });
    const next = createAdapter('slack');
    const adapters = new Map<ChannelName, Adapter>([['slack', existing]]);

    const manager = new AdapterRuntimeManager({
      config,
      logger,
      onInbound,
      adapters,
      adapterReloadCreators: {
        slack: () => next,
      },
    });

    await manager.reloadSlackAdapter();

    expect(existing.stop).toHaveBeenCalledTimes(1);
    expect(next.start).toHaveBeenCalledTimes(1);
    expect(manager.getAdapters().get('slack')).toBe(next);
    expect(warnSpy).toHaveBeenCalled();
  });
});
