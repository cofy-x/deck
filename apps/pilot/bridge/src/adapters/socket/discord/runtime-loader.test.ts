/**
 * @license
 * Copyright 2026 cofy-x
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, expect, test, vi } from 'vitest';

import { createDiscordRuntimeLoader } from './runtime-loader.js';
import type {
  DiscordClientOptions,
  DiscordRuntimeDeps,
} from './types.js';

type WithPatchedDiscordWsFn = typeof import('./ws-proxy-patch.js').withPatchedDiscordWs;

function createRuntimeDeps(): DiscordRuntimeDeps {
  return {
    Client: class {
      constructor(_options: DiscordClientOptions) {
        return {
          login: async () => undefined,
          destroy: async () => undefined,
          channels: {
            fetch: async () => null,
          },
          user: null,
          on: () => undefined,
        };
      }
    } as unknown as DiscordRuntimeDeps['Client'],
    GatewayIntentBits: {
      Guilds: 1,
      GuildMessages: 2,
      DirectMessages: 3,
      MessageContent: 4,
    },
    Partials: {
      Channel: 5,
    },
    Events: {
      MessageCreate: 'messageCreate',
    },
    ChannelType: {
      DM: 1,
    },
    DefaultWebSocketManagerOptions: {
      handshakeTimeout: 30_000,
    },
  };
}

describe('createDiscordRuntimeLoader', () => {
  test('loads discord runtime once under concurrent requests', async () => {
    const lifecycle: string[] = [];
    const runtimeDeps = createRuntimeDeps();

    const importRuntime = vi.fn(async () => {
      lifecycle.push('import:start');
      await Promise.resolve();
      lifecycle.push('import:end');
      return runtimeDeps;
    });

    const withPatchedSpy = vi.fn<(proxyUrl: string | undefined) => void>();
    const withPatchedDiscordWs: WithPatchedDiscordWsFn = async <T>(
      proxyUrl: string | undefined,
      run: () => Promise<T>,
    ) => {
      withPatchedSpy(proxyUrl);
      lifecycle.push(`patch:${proxyUrl ?? 'none'}`);
      try {
        return await run();
      } finally {
        lifecycle.push('unpatch');
      }
    };

    const loader = createDiscordRuntimeLoader({
      importRuntime,
      withPatchedDiscordWs,
    });

    const [first, second, third] = await Promise.all([
      loader.load({ gatewayProxyUrl: 'socks5h://127.0.0.1:7890' }),
      loader.load({ gatewayProxyUrl: 'socks5h://127.0.0.1:7890' }),
      loader.load({ gatewayProxyUrl: 'socks5h://127.0.0.1:7890' }),
    ]);

    expect(first).toBe(runtimeDeps);
    expect(second).toBe(runtimeDeps);
    expect(third).toBe(runtimeDeps);
    expect(importRuntime).toHaveBeenCalledTimes(1);
    expect(withPatchedSpy).toHaveBeenCalledTimes(1);
    expect(lifecycle).toEqual([
      'patch:socks5h://127.0.0.1:7890',
      'import:start',
      'import:end',
      'unpatch',
    ]);
  });

  test('reuses cached runtime after first load', async () => {
    const runtimeDeps = createRuntimeDeps();
    const importRuntime = vi.fn(async () => runtimeDeps);
    const withPatchedSpy = vi.fn<(proxyUrl: string | undefined) => void>();
    const withPatchedDiscordWs: WithPatchedDiscordWsFn = async <T>(
      proxyUrl: string | undefined,
      run: () => Promise<T>,
    ) => {
      withPatchedSpy(proxyUrl);
      return run();
    };

    const loader = createDiscordRuntimeLoader({
      importRuntime,
      withPatchedDiscordWs,
    });

    const first = await loader.load({ gatewayProxyUrl: 'socks5h://127.0.0.1:7890' });
    const second = await loader.load({ gatewayProxyUrl: undefined });

    expect(first).toBe(runtimeDeps);
    expect(second).toBe(runtimeDeps);
    expect(importRuntime).toHaveBeenCalledTimes(1);
    expect(withPatchedSpy).toHaveBeenCalledTimes(1);
  });
});
