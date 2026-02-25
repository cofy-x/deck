/**
 * @license
 * Copyright 2026 cofy-x
 * SPDX-License-Identifier: Apache-2.0
 */

export type DiscordInboundRejectReason =
  | 'groups disabled'
  | 'empty content'
  | 'bot not mentioned'
  | 'empty after removing mention';

export type NormalizedDiscordInbound =
  | {
      accepted: true;
      isDirect: boolean;
      text: string;
    }
  | {
      accepted: false;
      isDirect: boolean;
      reason: DiscordInboundRejectReason;
    };

interface DiscordMessageLike {
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

export interface NormalizeDiscordInboundMessageInput {
  message: DiscordMessageLike;
  groupsEnabled: boolean;
  mentionInGuilds: boolean;
  botUserId: string | null;
  dmChannelType: number;
}

function stripBotMention(input: string, botUserId: string | null): string {
  if (!botUserId) {
    return input.trim();
  }

  const token = `<@${botUserId}>`;
  const tokenNick = `<@!${botUserId}>`;
  return input.replaceAll(token, ' ').replaceAll(tokenNick, ' ').trim();
}

export function normalizeDiscordInboundMessage(
  input: NormalizeDiscordInboundMessageInput,
): NormalizedDiscordInbound {
  const isDirect = input.message.channel.type === input.dmChannelType;

  if (!isDirect && !input.groupsEnabled) {
    return {
      accepted: false,
      isDirect,
      reason: 'groups disabled',
    };
  }

  let text = input.message.content.trim();
  if (!text) {
    return {
      accepted: false,
      isDirect,
      reason: 'empty content',
    };
  }

  if (!isDirect && input.mentionInGuilds) {
    const mentioned = input.botUserId
      ? input.message.mentions.users.has(input.botUserId)
      : false;
    if (!mentioned) {
      return {
        accepted: false,
        isDirect,
        reason: 'bot not mentioned',
      };
    }

    text = stripBotMention(text, input.botUserId);
    if (!text) {
      return {
        accepted: false,
        isDirect,
        reason: 'empty after removing mention',
      };
    }
  }

  return {
    accepted: true,
    isDirect,
    text,
  };
}
