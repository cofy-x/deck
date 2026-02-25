/**
 * @license
 * Copyright 2026 cofy-x
 * SPDX-License-Identifier: Apache-2.0
 */

import pino from 'pino';
import { describe, expect, test, vi } from 'vitest';

import type { Config, MessageHandler } from '../../types/index.js';
import { createAdapterTestConfig } from '../test-fixtures.js';
import { createSlackAdapter, type SlackDeps } from './slack.js';

type SlackHandler = (args: {
  ack?: () => Promise<void>;
  event?: Record<string, unknown>;
}) => Promise<void>;

class FakeSocketModeClient {
  readonly start = vi.fn(async () => undefined);

  readonly disconnect = vi.fn(async () => undefined);

  private readonly handlers = new Map<string, SlackHandler>();

  constructor(_options: object) {}

  on(event: string, handler: SlackHandler): void {
    this.handlers.set(event, handler);
  }

  async emit(event: string, args: Parameters<SlackHandler>[0]): Promise<void> {
    const handler = this.handlers.get(event);
    if (!handler) {
      throw new Error(`Missing handler for event: ${event}`);
    }
    await handler(args);
  }
}

class FakeWebClient {
  readonly auth = {
    test: vi.fn(async () => ({ user_id: 'U_BOT' })),
  };

  readonly chat = {
    postMessage: vi.fn(async () => ({})),
  };

  constructor(_token: string, _options: object) {}
}

describe('createSlackAdapter', () => {
  test('start/stop are idempotent', async () => {
    const logger = pino({ enabled: false });
    const config = createAdapterTestConfig();
    const onMessage = vi.fn<MessageHandler>(async () => undefined);
    const socket = new FakeSocketModeClient({});

    const deps: SlackDeps = {
      WebClient: FakeWebClient as unknown as SlackDeps['WebClient'],
      SocketModeClient: class {
        constructor(_options: object) {
          return socket;
        }
      } as unknown as SlackDeps['SocketModeClient'],
    };

    const adapter = createSlackAdapter(config, logger, onMessage, deps);
    await Promise.all([adapter.start(), adapter.start()]);
    await Promise.resolve();
    await adapter.stop();
    await adapter.stop();

    expect(socket.start).toHaveBeenCalledTimes(1);
    expect(socket.disconnect).toHaveBeenCalledTimes(1);
  });

  test('routes DM and mention events through inbound handler', async () => {
    const logger = pino({ enabled: false });
    const config: Config = createAdapterTestConfig({
      slackBotToken: 'xoxb-test',
      slackAppToken: 'xapp-test',
    });
    const onMessage = vi.fn<MessageHandler>(async () => undefined);
    const socket = new FakeSocketModeClient({});

    const deps: SlackDeps = {
      WebClient: FakeWebClient as unknown as SlackDeps['WebClient'],
      SocketModeClient: class {
        constructor(_options: object) {
          return socket;
        }
      } as unknown as SlackDeps['SocketModeClient'],
    };

    const adapter = createSlackAdapter(config, logger, onMessage, deps);
    await adapter.start();
    await Promise.resolve();

    const ack = vi.fn(async () => undefined);

    await socket.emit('message', {
      ack,
      event: {
        channel: 'D123',
        text: 'hello from dm',
        user: 'U_USER',
      },
    });

    await socket.emit('message', {
      ack,
      event: {
        channel: 'C123',
        text: 'ignore channel message',
        user: 'U_USER',
      },
    });

    await socket.emit('app_mention', {
      ack,
      event: {
        channel: 'C123',
        text: '<@U_BOT> run this',
        user: 'U_USER',
        ts: '1700000.0001',
      },
    });

    expect(ack).toHaveBeenCalledTimes(3);
    expect(onMessage).toHaveBeenCalledTimes(2);
    expect(onMessage).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        channel: 'slack',
        peerId: 'D123',
        text: 'hello from dm',
      }),
    );
    expect(onMessage).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        channel: 'slack',
        peerId: 'C123|1700000.0001',
        text: 'run this',
      }),
    );
  });
});
