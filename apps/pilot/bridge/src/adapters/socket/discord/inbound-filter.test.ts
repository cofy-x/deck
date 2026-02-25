/**
 * @license
 * Copyright 2026 cofy-x
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, expect, test } from 'vitest';

import { normalizeDiscordInboundMessage } from './inbound-filter.js';

interface FakeMessage {
  channel: {
    type: number;
  };
  content: string;
  mentions: {
    users: {
      has(userId: string): boolean;
    };
  };
}

function createMessage(overrides: Partial<FakeMessage> = {}): FakeMessage {
  return {
    channel: {
      type: 0,
    },
    content: 'hello',
    mentions: {
      users: {
        has: () => false,
      },
    },
    ...overrides,
  };
}

describe('normalizeDiscordInboundMessage', () => {
  test('rejects guild messages when groups are disabled', () => {
    const normalized = normalizeDiscordInboundMessage({
      message: createMessage({ channel: { type: 0 } }),
      groupsEnabled: false,
      mentionInGuilds: false,
      botUserId: 'BOT_ID',
      dmChannelType: 1,
    });

    expect(normalized).toEqual({
      accepted: false,
      isDirect: false,
      reason: 'groups disabled',
    });
  });

  test('rejects empty content', () => {
    const normalized = normalizeDiscordInboundMessage({
      message: createMessage({ content: '   ' }),
      groupsEnabled: true,
      mentionInGuilds: false,
      botUserId: 'BOT_ID',
      dmChannelType: 1,
    });

    expect(normalized).toEqual({
      accepted: false,
      isDirect: false,
      reason: 'empty content',
    });
  });

  test('rejects guild messages without bot mention when mention is required', () => {
    const normalized = normalizeDiscordInboundMessage({
      message: createMessage(),
      groupsEnabled: true,
      mentionInGuilds: true,
      botUserId: 'BOT_ID',
      dmChannelType: 1,
    });

    expect(normalized).toEqual({
      accepted: false,
      isDirect: false,
      reason: 'bot not mentioned',
    });
  });

  test('rejects empty content after removing mention', () => {
    const normalized = normalizeDiscordInboundMessage({
      message: createMessage({
        content: '<@BOT_ID>   ',
        mentions: {
          users: {
            has: (userId: string) => userId === 'BOT_ID',
          },
        },
      }),
      groupsEnabled: true,
      mentionInGuilds: true,
      botUserId: 'BOT_ID',
      dmChannelType: 1,
    });

    expect(normalized).toEqual({
      accepted: false,
      isDirect: false,
      reason: 'empty after removing mention',
    });
  });

  test('accepts direct message without mention even when mention is required for guilds', () => {
    const normalized = normalizeDiscordInboundMessage({
      message: createMessage({
        channel: { type: 1 },
        content: 'hi from dm',
      }),
      groupsEnabled: false,
      mentionInGuilds: true,
      botUserId: 'BOT_ID',
      dmChannelType: 1,
    });

    expect(normalized).toEqual({
      accepted: true,
      isDirect: true,
      text: 'hi from dm',
    });
  });
});
