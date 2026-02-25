/**
 * @license
 * Copyright 2025 cofy-x
 * SPDX-License-Identifier: Apache-2.0
 */

import { setTimeout as delay } from 'node:timers/promises';

import { ImapFlow } from 'imapflow';
import { simpleParser } from 'mailparser';
import nodemailer from 'nodemailer';
import type { Logger } from 'pino';

import type { Adapter, Config, MessageHandler } from '../../types/index.js';

export interface EmailAdapter extends Adapter {
  name: 'email';
}

const MAX_TEXT_LENGTH = 12_000;

interface LastInboundMessage {
  subject: string;
  messageId: string;
}

function normalizeSubject(subject: string, prefix: string): string {
  const trimmed = subject.trim();
  if (!trimmed) return `${prefix.trim()} bridge reply`;
  if (trimmed.toLowerCase().startsWith('re:')) return trimmed;
  return `${prefix}${trimmed}`;
}

export class EmailAdapterImpl implements EmailAdapter {
  readonly name = 'email' as const;

  readonly maxTextLength = MAX_TEXT_LENGTH;

  readonly capabilities = {
    progress: false,
    typing: false,
    file: false,
  } as const;

  private readonly log: Logger;

  private stopped = false;

  private pollTask: Promise<void> | null = null;

  private polling = false;

  private readonly lastInboundBySender = new Map<string, LastInboundMessage>();

  private readonly processedMessageIds = new Set<string>();

  private readonly isConfigured: boolean;

  constructor(
    private readonly config: Config,
    logger: Logger,
    private readonly onMessage: MessageHandler,
  ) {
    this.log = logger.child({ channel: 'email' });
    this.isConfigured =
      Boolean(config.emailImapHost) &&
      Boolean(config.emailImapUser) &&
      Boolean(config.emailImapPassword) &&
      Boolean(config.emailSmtpHost) &&
      Boolean(config.emailSmtpUser) &&
      Boolean(config.emailSmtpPassword);
  }

  async start(): Promise<void> {
    if (!this.isConfigured) {
      throw new Error('Email adapter requires IMAP/SMTP credentials');
    }
    if (this.pollTask) return;

    this.stopped = false;
    this.pollTask = this.runPollingLoop().finally(() => {
      this.pollTask = null;
    });
    this.log.info('email adapter started');
  }

  async stop(): Promise<void> {
    this.stopped = true;
    if (this.pollTask) {
      await this.pollTask.catch(() => undefined);
      this.pollTask = null;
    }
    this.log.info('email adapter stopped');
  }

  async sendText(peerId: string, text: string): Promise<void> {
    if (!this.isConfigured) {
      throw new Error('Email adapter requires IMAP/SMTP credentials');
    }
    if (!this.config.emailAutoReplyEnabled) {
      this.log.info({ peerId }, 'email auto reply disabled, skip outbound message');
      return;
    }

    const lastInbound = this.lastInboundBySender.get(peerId);
    const subject = normalizeSubject(
      lastInbound?.subject ?? 'bridge reply',
      this.config.emailSubjectPrefix,
    );

    const transporter = nodemailer.createTransport({
      host: this.config.emailSmtpHost,
      port: this.config.emailSmtpPort,
      secure: this.config.emailSmtpSecure,
      auth: {
        user: this.config.emailSmtpUser,
        pass: this.config.emailSmtpPassword,
      },
    });

    await transporter.sendMail({
      from:
        this.config.emailFromAddress ||
        this.config.emailSmtpUser ||
        this.config.emailImapUser,
      to: peerId,
      subject,
      text,
      ...(lastInbound?.messageId
        ? {
            inReplyTo: lastInbound.messageId,
            references: lastInbound.messageId,
          }
        : {}),
    });
  }

  private async runPollingLoop(): Promise<void> {
    const intervalMs = Math.max(5, this.config.emailPollIntervalSeconds) * 1000;
    while (!this.stopped) {
      try {
        await this.pollMailbox();
      } catch (error) {
        this.log.warn({ error }, 'email polling iteration failed');
      }
      await delay(intervalMs);
    }
  }

  private async pollMailbox(): Promise<void> {
    if (this.polling || this.stopped) return;
    this.polling = true;

    const client = new ImapFlow({
      host: this.config.emailImapHost!,
      port: this.config.emailImapPort,
      secure: this.config.emailImapSecure,
      auth: {
        user: this.config.emailImapUser!,
        pass: this.config.emailImapPassword!,
      },
    });

    try {
      await client.connect();
      await client.mailboxOpen(this.config.emailImapMailbox);
      const ids = await client.search({ seen: false });
      if (!ids || ids.length === 0) {
        return;
      }

      for (const id of ids) {
        const fetched = await client.fetchOne(id, {
          envelope: true,
          source: true,
        });
        if (!fetched) continue;
        const source = fetched.source;
        if (!source) continue;

        const parsed = await simpleParser(source);
        const messageId = (parsed.messageId ?? '').trim();
        if (messageId && this.processedMessageIds.has(messageId)) {
          await client.messageFlagsAdd(id, ['\\Seen']);
          continue;
        }

        const sender = parsed.from?.value[0]?.address?.trim().toLowerCase();
        if (!sender) continue;

        const text = (parsed.text ?? '').trim();
        if (!text) continue;

        const subject = (parsed.subject ?? '').trim();
        this.lastInboundBySender.set(sender, {
          subject,
          messageId,
        });
        if (messageId) {
          this.processedMessageIds.add(messageId);
          if (this.processedMessageIds.size > 10_000) {
            this.processedMessageIds.clear();
          }
        }

        await this.onMessage({
          channel: 'email',
          peerId: sender,
          text: `Email from ${sender}${subject ? `\nSubject: ${subject}` : ''}\n\n${text}`,
          raw: {
            from: sender,
            subject,
            messageId,
          },
        });

        await client.messageFlagsAdd(id, ['\\Seen']);
      }
    } finally {
      this.polling = false;
      try {
        await client.logout();
      } catch {
        // ignore
      }
    }
  }
}

export function createEmailAdapter(
  config: Config,
  logger: Logger,
  onMessage: MessageHandler,
): EmailAdapter {
  return new EmailAdapterImpl(config, logger, onMessage);
}
