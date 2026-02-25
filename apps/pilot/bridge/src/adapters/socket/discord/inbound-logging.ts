/**
 * @license
 * Copyright 2026 cofy-x
 * SPDX-License-Identifier: Apache-2.0
 */

import type { DiscordInboundRejectReason } from './inbound-filter.js';
import type { DiscordMessage } from './types.js';

export interface IgnoredInboundLog {
  payload: Record<string, unknown>;
  message: string;
}

export function resolveIgnoredInboundLog(
  reason: DiscordInboundRejectReason,
  message: DiscordMessage,
  botUserId: string | null,
): IgnoredInboundLog {
  switch (reason) {
    case 'groups disabled':
      return {
        payload: {
          channelId: message.channelId,
          guildId: message.guildId,
        },
        message: 'discord message ignored (groups disabled)',
      };

    case 'empty content':
      return {
        payload: {
          channelId: message.channelId,
          guildId: message.guildId,
          authorId: message.author.id,
        },
        message: 'discord message ignored (empty content)',
      };

    case 'bot not mentioned':
      return {
        payload: {
          channelId: message.channelId,
          guildId: message.guildId,
          authorId: message.author.id,
          botUserId,
        },
        message: 'discord message ignored (bot not mentioned)',
      };

    case 'empty after removing mention':
      return {
        payload: {
          channelId: message.channelId,
          guildId: message.guildId,
          authorId: message.author.id,
        },
        message: 'discord message ignored (empty after removing mention)',
      };

    default:
      return {
        payload: {
          channelId: message.channelId,
          guildId: message.guildId,
        },
        message: `discord message ignored (${reason})`,
      };
  }
}
