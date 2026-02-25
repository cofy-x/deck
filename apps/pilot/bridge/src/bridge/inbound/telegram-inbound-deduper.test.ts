/**
 * @license
 * Copyright 2026 cofy-x
 * SPDX-License-Identifier: Apache-2.0
 */

import { afterEach, describe, expect, test, vi } from 'vitest';

import type { InboundMessage } from '../../types/index.js';
import { TelegramInboundDeduper } from './telegram-inbound-deduper.js';

function createTelegramMessage(
  messageID: number,
  chatID = 'chat_1',
): InboundMessage {
  return {
    channel: 'telegram',
    peerId: chatID,
    text: 'hello',
    raw: {
      message_id: messageID,
      chat: { id: chatID },
    },
  };
}

describe('TelegramInboundDeduper', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  test('marks repeated telegram message as duplicate within ttl', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T00:00:00.000Z'));

    const deduper = new TelegramInboundDeduper({ ttlMs: 1000 });
    const message = createTelegramMessage(1);

    expect(deduper.isDuplicate(message)).toBe(false);
    expect(deduper.isDuplicate(message)).toBe(true);
  });

  test('allows same message after ttl expires', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T00:00:00.000Z'));

    const deduper = new TelegramInboundDeduper({ ttlMs: 1000 });
    const message = createTelegramMessage(1);

    expect(deduper.isDuplicate(message)).toBe(false);
    vi.setSystemTime(new Date('2026-01-01T00:00:01.500Z'));
    expect(deduper.isDuplicate(message)).toBe(false);
  });

  test('evicts oldest entry when max capacity is exceeded', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T00:00:00.000Z'));

    const deduper = new TelegramInboundDeduper({ ttlMs: 60_000, maxEntries: 2 });
    const first = createTelegramMessage(1);
    const second = createTelegramMessage(2);
    const third = createTelegramMessage(3);

    expect(deduper.isDuplicate(first)).toBe(false);
    expect(deduper.isDuplicate(second)).toBe(false);
    expect(deduper.isDuplicate(third)).toBe(false);

    // First entry should be evicted after inserting third message.
    expect(deduper.isDuplicate(third)).toBe(true);
    expect(deduper.isDuplicate(first)).toBe(false);
  });
});
