/**
 * @license
 * Copyright 2025 cofy-x
 * SPDX-License-Identifier: Apache-2.0
 */

import { setTimeout as delay } from 'node:timers/promises';

import type { Logger } from 'pino';

import type {
  Adapter,
  Config,
  JsonValue,
  MessageHandler,
} from '../../types/index.js';

export interface MochatAdapter extends Adapter {
  name: 'mochat';
}

interface MochatEventPayload {
  messageId?: string;
  author?: string;
  content?: JsonValue;
}

interface MochatEvent {
  type?: string;
  seq?: number;
  payload?: MochatEventPayload;
}

interface MochatWatchData {
  sessionId?: string;
  cursor?: number;
  events?: MochatEvent[];
}

interface MochatApiEnvelope {
  code?: number;
  data?: MochatWatchData;
  events?: MochatEvent[];
  cursor?: number;
}

const MAX_TEXT_LENGTH = 12_000;
const MAX_SEEN_MESSAGE_IDS = 2_000;

function toText(content: JsonValue | undefined): string {
  if (typeof content === 'string') return content.trim();
  if (content === null || content === undefined) return '';
  try {
    return JSON.stringify(content);
  } catch {
    return String(content);
  }
}

export class MochatAdapterImpl implements MochatAdapter {
  readonly name = 'mochat' as const;

  readonly maxTextLength = MAX_TEXT_LENGTH;

  readonly capabilities = {
    progress: false,
    typing: false,
    file: false,
  } as const;

  private readonly log: Logger;

  private readonly baseUrl: string;

  private readonly sessionCursors = new Map<string, number>();

  private readonly seenBySession = new Map<string, string[]>();

  private readonly loopTasks = new Map<string, Promise<void>>();

  private stopped = false;

  constructor(
    private readonly config: Config,
    logger: Logger,
    private readonly onMessage: MessageHandler,
  ) {
    this.log = logger.child({ channel: 'mochat' });
    this.baseUrl = config.mochatBaseUrl.replace(/\/$/, '');
  }

  async start(): Promise<void> {
    if (!this.config.mochatClawToken) {
      throw new Error('MOCHAT_CLAW_TOKEN is required for Mochat adapter');
    }
    if (this.config.mochatSessions.length === 0) {
      this.log.warn('mochat adapter enabled but MOCHAT_SESSIONS is empty');
      return;
    }

    this.stopped = false;
    for (const sessionId of this.config.mochatSessions) {
      if (this.loopTasks.has(sessionId)) continue;
      const task = this.watchSession(sessionId)
        .catch((error) => {
          this.log.error({ error, sessionId }, 'mochat session watch loop crashed');
        })
        .finally(() => {
          this.loopTasks.delete(sessionId);
        });
      this.loopTasks.set(sessionId, task);
    }
    this.log.info({ sessions: this.config.mochatSessions }, 'mochat adapter started');
  }

  async stop(): Promise<void> {
    this.stopped = true;
    await Promise.all(
      [...this.loopTasks.values()].map((task) => task.catch(() => undefined)),
    );
    this.loopTasks.clear();
    this.sessionCursors.clear();
    this.seenBySession.clear();
    this.log.info('mochat adapter stopped');
  }

  async sendText(peerId: string, text: string): Promise<void> {
    if (!this.config.mochatClawToken) {
      throw new Error('MOCHAT_CLAW_TOKEN is required for Mochat adapter');
    }
    const response = await fetch(`${this.baseUrl}/api/claw/sessions/send`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({
        sessionId: peerId,
        content: text,
      }),
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(
        `Mochat send failed: ${response.status} ${body.slice(0, 200)}`,
      );
    }
  }

  private getHeaders(): Record<string, string> {
    return {
      'Content-Type': 'application/json',
      'X-Claw-Token': this.config.mochatClawToken ?? '',
    };
  }

  private rememberMessageId(sessionId: string, messageId: string): boolean {
    const entries = this.seenBySession.get(sessionId) ?? [];
    if (entries.includes(messageId)) return true;
    entries.push(messageId);
    while (entries.length > MAX_SEEN_MESSAGE_IDS) {
      entries.shift();
    }
    this.seenBySession.set(sessionId, entries);
    return false;
  }

  private parseWatchPayload(payload: MochatApiEnvelope): MochatWatchData {
    if (payload.data) {
      return {
        sessionId: payload.data.sessionId,
        cursor: payload.data.cursor,
        events: payload.data.events ?? [],
      };
    }
    return {
      cursor: payload.cursor,
      events: payload.events ?? [],
    };
  }

  private async watchSession(sessionId: string): Promise<void> {
    while (!this.stopped) {
      try {
        const cursor = this.sessionCursors.get(sessionId) ?? 0;
        const response = await fetch(`${this.baseUrl}/api/claw/sessions/watch`, {
          method: 'POST',
          headers: this.getHeaders(),
          body: JSON.stringify({
            sessionId,
            cursor,
            timeoutMs: this.config.mochatWatchTimeoutMs,
            limit: this.config.mochatWatchLimit,
          }),
        });

        if (!response.ok) {
          const body = await response.text();
          this.log.warn(
            { sessionId, status: response.status, body: body.slice(0, 120) },
            'mochat watch request failed',
          );
          await delay(1000);
          continue;
        }

        const parsed = (await response.json()) as MochatApiEnvelope;
        const watch = this.parseWatchPayload(parsed);
        const nextCursor = watch.cursor;
        if (typeof nextCursor === 'number' && nextCursor >= 0) {
          this.sessionCursors.set(sessionId, nextCursor);
        }

        for (const event of watch.events ?? []) {
          if (event.type !== 'message.add') continue;
          const payload = event.payload;
          if (!payload) continue;
          const author = payload.author?.trim() ?? '';
          if (!author) continue;

          const messageId = payload.messageId?.trim() ?? '';
          if (messageId && this.rememberMessageId(sessionId, messageId)) {
            continue;
          }

          const text = toText(payload.content);
          if (!text) continue;

          await this.onMessage({
            channel: 'mochat',
            peerId: sessionId,
            text,
            raw: event,
          });
        }
      } catch (error) {
        this.log.warn({ error, sessionId }, 'mochat watch loop failed');
        await delay(1000);
      }
    }
  }
}

export function createMochatAdapter(
  config: Config,
  logger: Logger,
  onMessage: MessageHandler,
): MochatAdapter {
  return new MochatAdapterImpl(config, logger, onMessage);
}
