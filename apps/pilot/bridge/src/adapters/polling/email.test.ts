/**
 * @license
 * Copyright 2026 cofy-x
 * SPDX-License-Identifier: Apache-2.0
 */

import { Buffer } from 'node:buffer';

import pino from 'pino';
import { beforeEach, describe, expect, test, vi } from 'vitest';

import { createAdapterTestConfig } from '../test-fixtures.js';
import { createEmailAdapter } from './email.js';

const emailMocks = vi.hoisted(() => {
  const sendMail = vi.fn(async () => ({}));
  const createTransport = vi.fn(() => ({ sendMail }));
  const simpleParser = vi.fn(async () => ({
    messageId: '<message-id>',
    subject: 'subject',
    text: 'mail text',
    from: {
      value: [{ address: 'sender@example.com' }],
    },
  }));
  const imapClient = {
    connect: vi.fn(async () => undefined),
    mailboxOpen: vi.fn(async () => undefined),
    search: vi.fn(async () => [] as number[]),
    fetchOne: vi.fn(async () => ({ source: Buffer.from('raw email') })),
    messageFlagsAdd: vi.fn(async () => undefined),
    logout: vi.fn(async () => undefined),
  };
  const ImapFlow = vi.fn((_options: object) => imapClient);
  return {
    sendMail,
    createTransport,
    simpleParser,
    imapClient,
    ImapFlow,
  };
});

vi.mock('nodemailer', () => ({
  default: {
    createTransport: emailMocks.createTransport,
  },
  createTransport: emailMocks.createTransport,
}));

vi.mock('mailparser', () => ({
  simpleParser: emailMocks.simpleParser,
}));

vi.mock('imapflow', () => ({
  ImapFlow: emailMocks.ImapFlow,
}));

describe('createEmailAdapter', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    emailMocks.createTransport.mockReturnValue({
      sendMail: emailMocks.sendMail,
    });
    emailMocks.simpleParser.mockResolvedValue({
      messageId: '<message-id>',
      subject: 'subject',
      text: 'mail text',
      from: {
        value: [{ address: 'sender@example.com' }],
      },
    });
    emailMocks.imapClient.search.mockResolvedValue([]);
    emailMocks.imapClient.fetchOne.mockResolvedValue({
      source: Buffer.from('raw email'),
    });
  });

  test('start fails when required credentials are missing', async () => {
    const logger = pino({ enabled: false });
    const config = createAdapterTestConfig({
      emailImapHost: undefined,
      emailSmtpHost: undefined,
    });

    const adapter = createEmailAdapter(config, logger, async () => undefined);
    await expect(adapter.start()).rejects.toThrow(
      'Email adapter requires IMAP/SMTP credentials',
    );
  });

  test('sendText is a no-op when auto reply is disabled', async () => {
    const logger = pino({ enabled: false });
    const config = createAdapterTestConfig({
      emailAutoReplyEnabled: false,
    });

    const adapter = createEmailAdapter(config, logger, async () => undefined);
    await expect(adapter.sendText('user@example.com', 'hello')).resolves.toBeUndefined();
    expect(emailMocks.createTransport).not.toHaveBeenCalled();
  });

  test('sendText sends via nodemailer when auto reply is enabled', async () => {
    const logger = pino({ enabled: false });
    const config = createAdapterTestConfig({
      emailAutoReplyEnabled: true,
    });

    const adapter = createEmailAdapter(config, logger, async () => undefined);
    await adapter.sendText('user@example.com', 'hello');

    expect(emailMocks.createTransport).toHaveBeenCalledTimes(1);
    expect(emailMocks.sendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'user@example.com',
        text: 'hello',
        subject: expect.any(String),
      }),
    );
  });

  test('pollMailbox uses ImapFlow and simpleParser to emit inbound message', async () => {
    const logger = pino({ enabled: false });
    const config = createAdapterTestConfig({
      emailAutoReplyEnabled: true,
    });
    const onMessage = vi.fn(async () => undefined);
    const adapter = createEmailAdapter(config, logger, onMessage);

    emailMocks.imapClient.search.mockResolvedValue([1]);
    emailMocks.imapClient.fetchOne.mockResolvedValue({
      source: Buffer.from('raw email'),
    });
    emailMocks.simpleParser.mockResolvedValue({
      messageId: '<message-id-1>',
      subject: 'hello',
      text: 'mail body',
      from: {
        value: [{ address: 'Sender@Example.com' }],
      },
    });

    await (
      adapter as unknown as {
        pollMailbox: () => Promise<void>;
      }
    ).pollMailbox();

    expect(emailMocks.ImapFlow).toHaveBeenCalledTimes(1);
    expect(emailMocks.simpleParser).toHaveBeenCalledTimes(1);
    expect(onMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        channel: 'email',
        peerId: 'sender@example.com',
      }),
    );
    expect(emailMocks.imapClient.messageFlagsAdd).toHaveBeenCalledWith(1, ['\\Seen']);
  });
});
