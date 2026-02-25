/**
 * @license
 * Copyright 2026 cofy-x
 * SPDX-License-Identifier: Apache-2.0
 */

import { z } from 'zod';

import type { InboundMessage } from '../../types/index.js';

const TelegramInboundRawSchema = z
  .object({
    message_id: z.number().optional(),
    chat: z
      .object({
        id: z.union([z.number(), z.string()]).optional(),
      })
      .optional(),
  })
  .loose();

export interface TelegramInboundDeduperOptions {
  ttlMs?: number;
  maxEntries?: number;
}

const DEFAULT_TTL_MS = 120_000;
const DEFAULT_MAX_ENTRIES = 2048;

export class TelegramInboundDeduper {
  private readonly seen = new Map<string, number>();

  private readonly ttlMs: number;

  private readonly maxEntries: number;

  constructor(options: TelegramInboundDeduperOptions = {}) {
    this.ttlMs = options.ttlMs ?? DEFAULT_TTL_MS;
    this.maxEntries = options.maxEntries ?? DEFAULT_MAX_ENTRIES;
  }

  isDuplicate(message: InboundMessage): boolean {
    if (message.channel !== 'telegram') return false;

    const parsedRaw = TelegramInboundRawSchema.safeParse(message.raw);
    if (!parsedRaw.success) return false;

    const messageID = parsedRaw.data.message_id;
    if (typeof messageID !== 'number') return false;

    const chatID = parsedRaw.data.chat?.id
      ? String(parsedRaw.data.chat.id)
      : message.peerId;
    const key = `${chatID}:${messageID}`;
    const now = Date.now();
    const seenAt = this.seen.get(key);
    if (seenAt !== undefined && now - seenAt <= this.ttlMs) {
      return true;
    }

    this.seen.set(key, now);
    this.prune(now);
    return false;
  }

  clear(): void {
    this.seen.clear();
  }

  private prune(now: number): void {
    if (this.seen.size <= this.maxEntries) return;

    for (const [key, seenAt] of this.seen) {
      if (now - seenAt > this.ttlMs) {
        this.seen.delete(key);
      }
    }

    if (this.seen.size <= this.maxEntries) return;

    const oldestKey = this.seen.keys().next().value;
    if (oldestKey) {
      this.seen.delete(oldestKey);
    }
  }
}
