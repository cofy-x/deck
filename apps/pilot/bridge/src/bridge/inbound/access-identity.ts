/**
 * @license
 * Copyright 2026 cofy-x
 * SPDX-License-Identifier: Apache-2.0
 */

import { normalizeWhatsAppId } from '../../config.js';
import type { InboundMessage } from '../../types/index.js';

export interface AccessIdentity {
  sessionKey: string;
  accessKey: string;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
}

function toIdString(value: unknown): string | null {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed ? trimmed : null;
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    return String(value);
  }
  return null;
}

function toTelegramAccessKey(
  message: InboundMessage,
  sessionKey: string,
): string {
  const raw = asRecord(message.raw);
  const chat = asRecord(raw?.['chat']);
  const chatType = toIdString(chat?.['type']);
  if (chatType !== 'private') return sessionKey;

  const from = asRecord(raw?.['from']);
  return toIdString(from?.['id']) ?? sessionKey;
}

function toSlackAccessKey(
  message: InboundMessage,
  sessionKey: string,
): string {
  const raw = asRecord(message.raw);
  return toIdString(raw?.['user']) ?? sessionKey;
}

function toDiscordAccessKey(
  message: InboundMessage,
  sessionKey: string,
): string {
  const raw = asRecord(message.raw);
  return toIdString(raw?.['authorId']) ?? sessionKey;
}

function toFeishuAccessKey(
  message: InboundMessage,
  sessionKey: string,
): string {
  const raw = asRecord(message.raw);
  const event = asRecord(raw?.['event']);
  const sender = asRecord(event?.['sender']);
  const senderId = asRecord(sender?.['sender_id']);
  const openId = toIdString(senderId?.['open_id']);
  if (openId) return openId;
  const userId = toIdString(senderId?.['user_id']);
  if (userId) return userId;
  const msg = asRecord(event?.['message']);
  return toIdString(msg?.['chat_id']) ?? sessionKey;
}

function toDingTalkAccessKey(
  message: InboundMessage,
  sessionKey: string,
): string {
  const raw = asRecord(message.raw);
  const senderStaffId = toIdString(raw?.['senderStaffId']);
  if (senderStaffId) return senderStaffId;
  const senderId = toIdString(raw?.['senderId']);
  if (senderId) return senderId;
  return toIdString(raw?.['conversationId']) ?? sessionKey;
}

function toQqAccessKey(message: InboundMessage, sessionKey: string): string {
  const raw = asRecord(message.raw);
  return toIdString(raw?.['user_id']) ?? sessionKey;
}

function resolveSessionKey(message: InboundMessage): string {
  if (message.channel === 'whatsapp') {
    return normalizeWhatsAppId(message.peerId);
  }
  return message.peerId;
}

export function resolveAccessIdentity(message: InboundMessage): AccessIdentity {
  const sessionKey = resolveSessionKey(message);

  let accessKey = sessionKey;
  switch (message.channel) {
    case 'telegram':
      accessKey = toTelegramAccessKey(message, sessionKey);
      break;
    case 'slack':
      accessKey = toSlackAccessKey(message, sessionKey);
      break;
    case 'discord':
      accessKey = toDiscordAccessKey(message, sessionKey);
      break;
    case 'feishu':
      accessKey = toFeishuAccessKey(message, sessionKey);
      break;
    case 'dingtalk':
      accessKey = toDingTalkAccessKey(message, sessionKey);
      break;
    case 'qq':
      accessKey = toQqAccessKey(message, sessionKey);
      break;
    default:
      accessKey = sessionKey;
      break;
  }

  return {
    sessionKey,
    accessKey,
  };
}
