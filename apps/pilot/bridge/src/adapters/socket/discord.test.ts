/**
 * @license
 * Copyright 2026 cofy-x
 * SPDX-License-Identifier: Apache-2.0
 */

import pino from 'pino';
import { afterEach, describe, expect, test, vi } from 'vitest';

import type { MessageHandler } from '../../types/index.js';
import { createAdapterTestConfig } from '../test-fixtures.js';
import {
  createDiscordAdapter,
  type DiscordDeps,
} from './discord.js';
import type {
  DiscordClientOptions,
} from './discord/types.js';

const originalEnv = { ...process.env };

afterEach(() => {
  process.env = { ...originalEnv };
});

interface FakeDiscordMessage {
  author: {
    bot: boolean;
    id: string;
  };
  channel: {
    type: number;
  };
  channelId: string;
  content: string;
  mentions: {
    users: {
      has(userID: string): boolean;
    };
  };
  id: string;
  guildId: string | null;
}

class FakeDiscordClient {
  readonly login = vi.fn(async () => 'ok');

  readonly destroy = vi.fn(async () => undefined);

  readonly channels = {
    fetch: vi.fn(async (_peerId: string) => ({
      isTextBased: () => true,
      send: vi.fn(async () => ({})),
      sendTyping: vi.fn(async () => ({})),
    })),
  };

  user: { id: string } | null = { id: 'BOT_ID' };

  constructorOptions: DiscordClientOptions | null = null;

  private readonly handlers = new Map<string, (message: FakeDiscordMessage) => void>();

  on(event: string, listener: (message: FakeDiscordMessage) => void): void {
    this.handlers.set(event, listener);
  }

  emitMessage(message: FakeDiscordMessage): void {
    const handler = this.handlers.get('messageCreate');
    if (!handler) {
      throw new Error('messageCreate handler not registered');
    }
    handler(message);
  }
}

function createDiscordDeps(
  client: FakeDiscordClient,
  options: {
    handshakeTimeout?: number;
  } = {},
): DiscordDeps {
  return {
    Client: class {
      constructor(options: DiscordClientOptions) {
        client.constructorOptions = options;
        return client;
      }
    } as unknown as DiscordDeps['Client'],
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
      handshakeTimeout: options.handshakeTimeout ?? 30_000,
    },
  };
}

describe('createDiscordAdapter', () => {
  test('throws when token is missing', () => {
    const logger = pino({ enabled: false });
    const config = createAdapterTestConfig({ discordToken: undefined });

    expect(() =>
      createDiscordAdapter(config, logger, async () => undefined),
    ).toThrow('DISCORD_BOT_TOKEN is required for Discord adapter');
  });

  test('filters guild messages and handles mention payload', async () => {
    const logger = pino({ enabled: false });
    const config = createAdapterTestConfig({
      groupsEnabled: true,
      discordMentionInGuilds: true,
    });
    const onMessage = vi.fn<MessageHandler>(async () => undefined);
    const client = new FakeDiscordClient();
    const deps = createDiscordDeps(client);

    const adapter = createDiscordAdapter(config, logger, onMessage, deps);
    await adapter.start();

    client.emitMessage({
      author: { bot: false, id: 'U1' },
      channel: { type: 0 },
      channelId: 'C1',
      content: 'plain group message',
      mentions: {
        users: {
          has: () => false,
        },
      },
      id: 'm1',
      guildId: 'g1',
    });

    client.emitMessage({
      author: { bot: false, id: 'U1' },
      channel: { type: 0 },
      channelId: 'C1',
      content: '<@BOT_ID> run test',
      mentions: {
        users: {
          has: (userID: string) => userID === 'BOT_ID',
        },
      },
      id: 'm2',
      guildId: 'g1',
    });

    await Promise.resolve();

    expect(onMessage).toHaveBeenCalledTimes(1);
    expect(onMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        channel: 'discord',
        peerId: 'C1',
        text: 'run test',
      }),
    );

    await adapter.stop();
    await adapter.stop();
    expect(client.destroy).toHaveBeenCalledTimes(1);
  });

  test('uses proxy dispatcher for REST when HTTPS_PROXY is configured', async () => {
    process.env = {
      ...process.env,
      HTTPS_PROXY: 'http://127.0.0.1:7890',
      NO_PROXY: '',
    };

    const logger = pino({ enabled: false });
    const config = createAdapterTestConfig({
      groupsEnabled: true,
      discordMentionInGuilds: true,
    });
    const onMessage = vi.fn<MessageHandler>(async () => undefined);
    const client = new FakeDiscordClient();
    const deps = createDiscordDeps(client);

    const adapter = createDiscordAdapter(config, logger, onMessage, deps);
    await adapter.start();

    expect(client.constructorOptions?.rest?.agent).toBeDefined();

    await adapter.stop();
  });

  test('uses default gateway handshake timeout when gateway proxy is enabled', async () => {
    process.env = {
      ...process.env,
      HTTPS_PROXY: 'http://127.0.0.1:7890',
      NO_PROXY: '',
    };

    const logger = pino({ enabled: false });
    const config = createAdapterTestConfig({
      groupsEnabled: true,
      discordMentionInGuilds: true,
    });
    const onMessage = vi.fn<MessageHandler>(async () => undefined);
    const client = new FakeDiscordClient();
    const deps = createDiscordDeps(client, { handshakeTimeout: 30_000 });
    const adapter = createDiscordAdapter(config, logger, onMessage, deps);

    await adapter.start();
    expect(deps.DefaultWebSocketManagerOptions?.handshakeTimeout).toBe(120_000);

    await adapter.stop();
    expect(deps.DefaultWebSocketManagerOptions?.handshakeTimeout).toBe(30_000);
  });

  test('uses gateway-only proxy without forcing REST proxy', async () => {
    process.env = {
      ...process.env,
      HTTPS_PROXY: '',
      HTTP_PROXY: '',
      ALL_PROXY: '',
      NO_PROXY: '',
      https_proxy: '',
      http_proxy: '',
      all_proxy: '',
      no_proxy: '',
    };

    const logger = pino({ enabled: false });
    const config = createAdapterTestConfig({
      groupsEnabled: true,
      discordMentionInGuilds: true,
      discordGatewayProxyUrl: 'socks5://127.0.0.1:7890',
    });
    const onMessage = vi.fn<MessageHandler>(async () => undefined);
    const client = new FakeDiscordClient();
    const deps = createDiscordDeps(client, { handshakeTimeout: 30_000 });
    const adapter = createDiscordAdapter(config, logger, onMessage, deps);

    await adapter.start();
    expect(client.constructorOptions?.rest?.agent).toBeUndefined();
    expect(deps.DefaultWebSocketManagerOptions?.handshakeTimeout).toBe(120_000);

    await adapter.stop();
    expect(deps.DefaultWebSocketManagerOptions?.handshakeTimeout).toBe(30_000);
  });

  test('overrides and restores gateway handshake timeout from config', async () => {
    const logger = pino({ enabled: false });
    const config = createAdapterTestConfig({
      groupsEnabled: true,
      discordMentionInGuilds: true,
      discordGatewayHandshakeTimeoutMs: 180_000,
    });
    const onMessage = vi.fn<MessageHandler>(async () => undefined);
    const client = new FakeDiscordClient();
    const deps = createDiscordDeps(client, { handshakeTimeout: 30_000 });
    const adapter = createDiscordAdapter(config, logger, onMessage, deps);

    await adapter.start();
    expect(deps.DefaultWebSocketManagerOptions?.handshakeTimeout).toBe(180_000);

    await adapter.stop();
    expect(deps.DefaultWebSocketManagerOptions?.handshakeTimeout).toBe(30_000);
  });
});
