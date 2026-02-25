/**
 * @license
 * Copyright 2026 cofy-x
 * SPDX-License-Identifier: Apache-2.0
 */

import pino from 'pino';
import { beforeEach, describe, expect, test, vi } from 'vitest';

import type { MessageHandler } from '../../../types/index.js';
import { createAdapterTestConfig } from '../../test-fixtures.js';
import { createWhatsAppAdapter } from './whatsapp-adapter.js';

type ConnectionUpdateHandler = (update: { connection?: string; lastDisconnect?: unknown }) => void;
type MessagesUpsertHandler = (payload: { messages: Array<Record<string, unknown>> }) => Promise<void>;

class FakeWhatsAppSocket {
  readonly sendMessage = vi.fn(async (_peerId: string, _payload: object) => ({
    key: { id: 'msg_1' },
  }));

  readonly sendPresenceUpdate = vi.fn(async () => undefined);

  readonly ws = {
    close: vi.fn(),
  };

  readonly end = vi.fn();

  private connectionHandler: ConnectionUpdateHandler | null = null;

  private upsertHandler: MessagesUpsertHandler | null = null;

  readonly ev = {
    on: (event: string, handler: unknown) => {
      if (event === 'connection.update') {
        this.connectionHandler = handler as ConnectionUpdateHandler;
      }
      if (event === 'messages.upsert') {
        this.upsertHandler = handler as MessagesUpsertHandler;
      }
    },
  };

  emitConnection(update: { connection?: string; lastDisconnect?: unknown }): void {
    this.connectionHandler?.(update);
  }

  async emitMessages(messages: Array<Record<string, unknown>>): Promise<void> {
    if (!this.upsertHandler) {
      throw new Error('messages.upsert handler is not registered');
    }
    await this.upsertHandler({ messages });
  }
}

const hoisted = vi.hoisted(() => ({
  latestSocket: null as FakeWhatsAppSocket | null,
  closeSocketSpy: vi.fn((socket: FakeWhatsAppSocket) => {
    socket.ws.close();
  }),
}));

vi.mock('./whatsapp-session.js', () => ({
  hasWhatsAppCreds: vi.fn(() => true),
  getStatusCode: vi.fn(() => undefined),
  createWhatsAppSocket: vi.fn(async () => {
    hoisted.latestSocket = new FakeWhatsAppSocket();
    return hoisted.latestSocket;
  }),
  closeWhatsAppSocket: hoisted.closeSocketSpy,
}));

describe('createWhatsAppAdapter', () => {
  beforeEach(() => {
    hoisted.latestSocket = null;
    hoisted.closeSocketSpy.mockClear();
  });

  test('filters self-chat and groups-disabled messages', async () => {
    const logger = pino({ enabled: false });
    const config = createAdapterTestConfig({
      whatsappSelfChatMode: false,
      groupsEnabled: false,
    });
    const onMessage = vi.fn<MessageHandler>(async () => undefined);

    const adapter = createWhatsAppAdapter(config, logger, onMessage);
    await adapter.start();

    if (!hoisted.latestSocket) {
      throw new Error('Expected fake WhatsApp socket to be created');
    }

    await hoisted.latestSocket.emitMessages([
      {
        key: {
          id: 'self_1',
          fromMe: true,
          remoteJid: '10001@s.whatsapp.net',
        },
        message: {
          conversation: 'self message',
        },
      },
      {
        key: {
          id: 'group_1',
          fromMe: false,
          remoteJid: '10001@g.us',
        },
        message: {
          conversation: 'group message',
        },
      },
      {
        key: {
          id: 'dm_1',
          fromMe: false,
          remoteJid: '10001@s.whatsapp.net',
        },
        message: {
          conversation: 'direct message',
        },
      },
    ]);

    expect(onMessage).toHaveBeenCalledTimes(1);
    expect(onMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        channel: 'whatsapp',
        peerId: '10001@s.whatsapp.net',
        text: 'direct message',
      }),
    );
  });

  test('sendFile falls back with error message when file is missing', async () => {
    const logger = pino({ enabled: false });
    const config = createAdapterTestConfig();

    const adapter = createWhatsAppAdapter(config, logger, async () => undefined);
    await adapter.start();

    if (!hoisted.latestSocket) {
      throw new Error('Expected fake WhatsApp socket to be created');
    }

    await adapter.sendFile('10001@s.whatsapp.net', '/tmp/file-not-found.png', 'caption');

    expect(hoisted.latestSocket.sendMessage).toHaveBeenCalledWith('10001@s.whatsapp.net', {
      text: 'Error: File not found.',
    });

    await adapter.stop();
    expect(hoisted.closeSocketSpy).toHaveBeenCalledTimes(1);
  });
});
