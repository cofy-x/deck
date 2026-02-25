/**
 * @license
 * Copyright 2026 cofy-x
 * SPDX-License-Identifier: Apache-2.0
 */

interface TextChannelLike {
  isTextBased(): boolean;
  send(text: string): Promise<unknown>;
}

interface TypingChannelLike {
  isTextBased(): boolean;
  sendTyping(): Promise<unknown>;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function hasMethod(
  value: Record<string, unknown>,
  methodName: string,
): value is Record<string, (...args: unknown[]) => unknown> {
  return typeof value[methodName] === 'function';
}

export function isTextChannel(channel: unknown): channel is TextChannelLike {
  if (!isRecord(channel)) {
    return false;
  }
  if (!hasMethod(channel, 'isTextBased') || !channel['isTextBased']()) {
    return false;
  }
  return hasMethod(channel, 'send');
}

export function isTypingChannel(channel: unknown): channel is TypingChannelLike {
  if (!isRecord(channel)) {
    return false;
  }
  if (!hasMethod(channel, 'isTextBased') || !channel['isTextBased']()) {
    return false;
  }
  return hasMethod(channel, 'sendTyping');
}
