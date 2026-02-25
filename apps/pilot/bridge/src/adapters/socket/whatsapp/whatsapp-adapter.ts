/**
 * @license
 * Copyright 2025 cofy-x
 * SPDX-License-Identifier: Apache-2.0
 */

import fs from 'node:fs';
import path from 'node:path';

import { DisconnectReason, isJidGroup } from '@whiskeysockets/baileys';
import type { ConnectionState, WAMessage } from '@whiskeysockets/baileys';
import type { Logger } from 'pino';

import type { Adapter, Config, MessageHandler } from '../../../types/index.js';
import {
  closeWhatsAppSocket,
  createWhatsAppSocket,
  getStatusCode,
  hasWhatsAppCreds,
} from './whatsapp-session.js';
import type { WhatsAppSocket } from './whatsapp-session.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface WhatsAppAdapter extends Adapter {
  name: 'whatsapp';
  sendFile(peerId: string, filePath: string, caption?: string): Promise<void>;
  sendTyping(peerId: string): Promise<void>;
}

interface LastDisconnect {
  error?: { output?: { statusCode?: number }; status?: number };
}

interface MediaContent {
  image?: { url: string };
  document?: { url: string };
  mimetype?: string;
  fileName?: string;
  caption?: string;
}

interface ReconnectPolicy {
  initialMs: number;
  maxMs: number;
  factor: number;
  jitter: number;
  maxAttempts: number;
}

export interface WhatsAppAdapterOptions {
  printQr?: boolean;
  onStatus?: (message: string) => void;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MAX_TEXT_LENGTH = 3800;
const SENT_MESSAGE_TTL_MS = 10 * 60_000;

const DEFAULT_RECONNECT_POLICY: ReconnectPolicy = {
  initialMs: 1500,
  maxMs: 30_000,
  factor: 1.6,
  jitter: 0.25,
  maxAttempts: 10,
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function extractText(message: WAMessage): string {
  const content = message.message;
  if (!content) return '';
  return (
    content.conversation ||
    content.extendedTextMessage?.text ||
    content.imageMessage?.caption ||
    content.videoMessage?.caption ||
    content.documentMessage?.caption ||
    ''
  );
}

function computeReconnectDelay(
  attempt: number,
  policy: ReconnectPolicy,
): number {
  const base =
    policy.initialMs * Math.pow(policy.factor, Math.max(0, attempt - 1));
  const capped = Math.min(base, policy.maxMs);
  const jitter = capped * policy.jitter * (Math.random() * 2 - 1);
  return Math.max(250, Math.round(capped + jitter));
}

export class WhatsAppAdapterImpl implements WhatsAppAdapter {
  readonly name = 'whatsapp' as const;

  readonly maxTextLength = MAX_TEXT_LENGTH;

  readonly capabilities = {
    progress: false,
    typing: true,
    file: true,
  } as const;

  private socket: WhatsAppSocket | null = null;

  private stopped = false;

  private connecting = false;

  private reconnectAttempts = 0;

  private reconnectTimer: NodeJS.Timeout | null = null;

  private readonly sentMessageIds = new Map<string, number>();

  private readonly log: Logger;

  private readonly authDir: string;

  private readonly policy = DEFAULT_RECONNECT_POLICY;

  constructor(
    private readonly config: Config,
    logger: Logger,
    private readonly onMessage: MessageHandler,
    private readonly opts: WhatsAppAdapterOptions = {},
  ) {
    this.log = logger.child({ channel: 'whatsapp' });
    this.authDir = path.resolve(config.whatsappAuthDir);
  }

  async start(): Promise<void> {
    await this.connect();
  }

  async stop(): Promise<void> {
    this.stopped = true;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.socket) {
      closeWhatsAppSocket(this.socket);
      this.socket = null;
    }
  }

  async sendText(peerId: string, text: string): Promise<void> {
    if (!this.socket) throw new Error('WhatsApp socket not initialized');
    const sent = await this.socket.sendMessage(peerId, { text });
    this.recordSentMessage(sent?.key?.id);
  }

  async sendFile(peerId: string, filePath: string, caption = ''): Promise<void> {
    if (!this.socket) throw new Error('WhatsApp socket not initialized');

    const ext = path.extname(filePath).toLowerCase();
    let msgContent: MediaContent = {};

    try {
      if (!fs.existsSync(filePath)) {
        const sent = await this.socket.sendMessage(peerId, {
          text: 'Error: File not found.',
        });
        this.recordSentMessage(sent?.key?.id);
        return;
      }

      if (['.jpg', '.jpeg', '.png', '.gif'].includes(ext)) {
        msgContent = { image: { url: filePath }, caption };
      } else {
        let mimetype = 'application/octet-stream';
        if (ext === '.pdf') mimetype = 'application/pdf';
        if (ext === '.txt') mimetype = 'text/plain';

        msgContent = {
          document: { url: filePath },
          mimetype,
          fileName: path.basename(filePath),
          caption,
        };
      }

      const sent = await this.socket.sendMessage(
        peerId,
        msgContent as Parameters<WhatsAppSocket['sendMessage']>[1],
      );
      this.recordSentMessage(sent?.key?.id);
    } catch (err) {
      this.log.error({ error: err, filePath }, 'failed to send file');
      const errorMessage = err instanceof Error ? err.message : 'File send error';
      const sent = await this.socket.sendMessage(peerId, {
        text: `Error sending file: ${errorMessage}`,
      });
      this.recordSentMessage(sent?.key?.id);
    }
  }

  async sendTyping(peerId: string): Promise<void> {
    if (!this.socket) return;
    try {
      await this.socket.sendPresenceUpdate('composing', peerId);
    } catch (error) {
      this.log.warn({ error, peerId }, 'whatsapp typing update failed');
    }
  }

  private logSkip(
    reason: string,
    details: {
      messageId?: string | null;
      peerId?: string | null;
      fromMe?: boolean;
      isGroup?: boolean;
      hasMessagePayload?: boolean;
    } = {},
  ): void {
    this.log.debug(
      {
        reason,
        ...details,
      },
      'whatsapp inbound skipped',
    );
  }

  private resetReconnect(): void {
    this.reconnectAttempts = 0;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  private scheduleReconnect(statusCode?: number): void {
    if (this.stopped || this.reconnectTimer) return;
    this.reconnectAttempts += 1;
    if (this.reconnectAttempts > this.policy.maxAttempts) {
      this.log.warn(
        { attempts: this.reconnectAttempts },
        'whatsapp reconnect attempts exhausted',
      );
      this.opts.onStatus?.(
        'WhatsApp reconnect attempts exhausted. Run: pilot-bridge whatsapp login.',
      );
      return;
    }
    const delayMs =
      statusCode === 515
        ? 1000
        : computeReconnectDelay(this.reconnectAttempts, this.policy);
    this.log.warn({ delayMs, statusCode }, 'whatsapp reconnect scheduled');
    this.opts.onStatus?.(`WhatsApp reconnecting in ${Math.round(delayMs / 1000)}s...`);
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      void this.connect({ printQr: false });
    }, delayMs);
  }

  private recordSentMessage(messageId?: string | null): void {
    if (!messageId) return;
    this.sentMessageIds.set(messageId, Date.now());
  }

  private pruneSentMessages(): void {
    const now = Date.now();
    for (const [id, timestamp] of this.sentMessageIds) {
      if (now - timestamp > SENT_MESSAGE_TTL_MS) {
        this.sentMessageIds.delete(id);
      }
    }
  }

  private async connect(options: { printQr?: boolean } = {}): Promise<void> {
    if (this.stopped || this.connecting) return;
    this.connecting = true;
    try {
      this.log.info(
        {
          authDir: this.authDir,
          hasCreds: hasWhatsAppCreds(this.authDir),
          reconnectAttempts: this.reconnectAttempts,
          printQr: options.printQr ?? this.opts.printQr ?? false,
        },
        'whatsapp connect start',
      );
      if (this.socket) {
        closeWhatsAppSocket(this.socket);
        this.socket = null;
      }
      const sock = await createWhatsAppSocket({
        authDir: this.authDir,
        logger: this.log,
        printQr: options.printQr ?? this.opts.printQr,
        onStatus: this.opts.onStatus,
      });

      sock.ev.on('connection.update', (update: Partial<ConnectionState>) => {
        const lastDisconnect = update.lastDisconnect as LastDisconnect | undefined;
        const statusCode = getStatusCode(lastDisconnect?.error ?? lastDisconnect);
        const qrPresent =
          'qr' in update &&
          Boolean((update as Partial<ConnectionState> & { qr?: string }).qr);
        this.log.info(
          {
            connection: update.connection,
            statusCode,
            reconnectAttempts: this.reconnectAttempts,
            qrPresent,
          },
          'whatsapp connection update',
        );

        if (update.connection === 'open') {
          this.resetReconnect();
        }
        if (update.connection === 'close') {
          if (statusCode === DisconnectReason.loggedOut) {
            this.log.warn("whatsapp logged out, run 'bridge whatsapp login'");
            this.opts.onStatus?.(
              'WhatsApp logged out. Run: pilot-bridge whatsapp login.',
            );
            return;
          }
          if (statusCode === 515) {
            this.opts.onStatus?.('WhatsApp asked for a restart; reconnecting.');
          }
          this.scheduleReconnect(statusCode);
        }
      });

      sock.ev.on(
        'messages.upsert',
        async ({ messages }: { messages: WAMessage[] }) => {
          this.pruneSentMessages();
          for (const msg of messages) {
            const fromMe = Boolean(msg.key.fromMe);
            const messageId = msg.key.id;
            const peerId = msg.key.remoteJid;
            const isGroup = peerId ? isJidGroup(peerId) : false;

            if (!msg.message) {
              this.logSkip('no_payload', {
                messageId,
                peerId,
                fromMe,
                isGroup,
                hasMessagePayload: false,
              });
              continue;
            }
            if (fromMe && messageId && this.sentMessageIds.has(messageId)) {
              this.sentMessageIds.delete(messageId);
              this.logSkip('echoed_outbound', {
                messageId,
                peerId,
                fromMe,
                isGroup,
                hasMessagePayload: true,
              });
              continue;
            }
            if (fromMe && !this.config.whatsappSelfChatMode) {
              this.logSkip('self_chat_disabled', {
                messageId,
                peerId,
                fromMe,
                isGroup,
                hasMessagePayload: true,
              });
              continue;
            }
            if (!peerId) {
              this.logSkip('missing_peer_id', {
                messageId,
                fromMe,
                isGroup,
                hasMessagePayload: true,
              });
              continue;
            }
            if (isJidGroup(peerId) && !this.config.groupsEnabled) {
              this.logSkip('groups_disabled', {
                messageId,
                peerId,
                fromMe,
                isGroup: true,
                hasMessagePayload: true,
              });
              continue;
            }
            const text = extractText(msg);
            if (!text.trim()) {
              this.logSkip('empty_text', {
                messageId,
                peerId,
                fromMe,
                isGroup,
                hasMessagePayload: true,
              });
              continue;
            }

            this.log.debug(
              {
                messageId,
                peerId,
                fromMe,
                isGroup,
                length: text.length,
              },
              'whatsapp inbound accepted',
            );

            try {
              await this.onMessage({
                channel: 'whatsapp',
                peerId,
                text,
                raw: msg,
                fromMe,
              });
            } catch (error) {
              this.log.error({ error, peerId }, 'whatsapp inbound handler failed');
            }
          }
        },
      );

      this.socket = sock;
    } finally {
      this.connecting = false;
    }
  }
}

// ---------------------------------------------------------------------------
// Adapter factory
// ---------------------------------------------------------------------------

export function createWhatsAppAdapter(
  config: Config,
  logger: Logger,
  onMessage: MessageHandler,
  opts: WhatsAppAdapterOptions = {},
): WhatsAppAdapter {
  return new WhatsAppAdapterImpl(config, logger, onMessage, opts);
}
