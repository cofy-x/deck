/**
 * @license
 * Copyright 2026 cofy-x
 * SPDX-License-Identifier: Apache-2.0
 */

import pino from 'pino';
import { describe, expect, test, vi } from 'vitest';

import type { OpencodeClient } from '../../../opencode.js';
import type {
  Adapter,
  ChannelName,
  Config,
  ConfigFile,
  HealthHandlers,
  HealthSnapshot,
} from '../../../types/index.js';
import { createBridgeTestConfig } from '../../stream/test-fixtures.js';
import type { HealthConfigStoreLike } from './health-config-store.js';
import { BridgeHealthRuntime } from './bridge-health-runtime.js';

function createAdapter(name: Adapter['name']): Adapter {
  return {
    name,
    maxTextLength: 4000,
    capabilities: {
      progress: false,
      typing: false,
      file: false,
    },
    start: async () => undefined,
    stop: async () => undefined,
    sendText: async () => undefined,
  };
}

describe('BridgeHealthRuntime', () => {
  test('starts health runtime, exposes handlers, and updates runtime config', async () => {
    const logger = pino({ enabled: false });
    const configFile: ConfigFile = { version: 1 };
    const config: Config = {
      ...createBridgeTestConfig(),
      configPath: '/tmp/bridge-health-runtime.test.json',
      configFile,
      groupsEnabled: false,
      healthPort: 18080,
    };

    const client = {
      global: {
        health: vi.fn(async () => ({
          data: { healthy: true, version: 'v-test' },
        })),
      },
    } as unknown as OpencodeClient;

    const adapters = new Map<ChannelName, Adapter>([
      ['telegram', createAdapter('telegram')],
    ]);
    const adapterManager = {
      reloadTelegramAdapter: vi.fn(async () => undefined),
      reloadSlackAdapter: vi.fn(async () => undefined),
    } as const;

    let persistedConfig = configFile;
    const persist = vi.fn((mutator: (current: ConfigFile) => ConfigFile) => {
      persistedConfig = mutator(persistedConfig);
      persistedConfig.version = persistedConfig.version ?? 1;
      config.configFile = persistedConfig;
      return persistedConfig;
    });
    const configStore: HealthConfigStoreLike = { persist };

    let capturedGetStatus: (() => HealthSnapshot) | null = null;
    let capturedHandlers: HealthHandlers | null = null;
    const stopServer = vi.fn();
    const startHealthServerFn = vi.fn(
      (
        _port: number,
        getStatus: () => HealthSnapshot,
        _logger: typeof logger,
        handlers: HealthHandlers = {},
      ) => {
        capturedGetStatus = getStatus;
        capturedHandlers = handlers;
        return stopServer;
      },
    );

    const intervalToken = {} as NodeJS.Timeout;
    const setIntervalSpy = vi.fn((_handler: () => void, _ms: number) => intervalToken);
    const clearIntervalSpy = vi.fn((_token: NodeJS.Timeout) => undefined);

    const runtime = new BridgeHealthRuntime({
      config,
      logger,
      client,
      adapters,
      adapterManager: adapterManager as never,
      configStore,
      startHealthServerFn,
      timerApi: {
        setInterval: setIntervalSpy,
        clearInterval: clearIntervalSpy,
      },
      healthIntervalMs: 10_000,
    });

    await runtime.start();

    expect(setIntervalSpy).toHaveBeenCalledWith(expect.any(Function), 10_000);
    expect(startHealthServerFn).toHaveBeenCalledWith(
      18080,
      expect.any(Function),
      logger,
      expect.any(Object),
    );
    expect(capturedGetStatus).toBeTypeOf('function');
    expect(capturedHandlers).not.toBeNull();
    if (!capturedGetStatus || !capturedHandlers) {
      throw new Error('Expected health runtime handlers to be captured');
    }
    const getStatus = capturedGetStatus as unknown as () => HealthSnapshot;
    const handlers = capturedHandlers as unknown as HealthHandlers;

    const snapshot = getStatus();
    expect(snapshot?.ok).toBe(true);
    expect(snapshot?.opencode.version).toBe('v-test');
    expect(snapshot?.channels.telegram).toBe(true);
    expect(snapshot?.config.groupsEnabled).toBe(false);

    const groupsResult = await handlers.setGroupsEnabled?.(true);
    expect(groupsResult).toEqual({ groupsEnabled: true });
    expect(config.groupsEnabled).toBe(true);
    expect(config.configFile.groupsEnabled).toBe(true);

    const telegramResult = await handlers.setTelegramToken?.(' token ');
    expect(telegramResult).toEqual({ configured: true, enabled: true });
    expect(config.telegramToken).toBe('token');
    expect(config.telegramEnabled).toBe(true);
    expect(adapterManager.reloadTelegramAdapter).toHaveBeenCalledTimes(1);

    const slackResult = await handlers.setSlackTokens?.({
      botToken: ' bot ',
      appToken: ' app ',
    });
    expect(slackResult).toEqual({ configured: true, enabled: true });
    expect(config.slackBotToken).toBe('bot');
    expect(config.slackAppToken).toBe('app');
    expect(config.slackEnabled).toBe(true);
    expect(adapterManager.reloadSlackAdapter).toHaveBeenCalledTimes(1);
    expect(persist).toHaveBeenCalledTimes(3);

    runtime.stop();
    expect(clearIntervalSpy).toHaveBeenCalledWith(intervalToken);
    expect(stopServer).toHaveBeenCalledTimes(1);
  });
});
