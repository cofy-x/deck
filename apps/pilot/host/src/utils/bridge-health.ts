/**
 * @license
 * Copyright 2026 cofy-x
 * SPDX-License-Identifier: Apache-2.0
 */

import type {
  BridgeChannelName,
  BridgeChannelsHealth,
  BridgeHealthSnapshot,
} from '../types/index.js';

// ---------------------------------------------------------------------------
// Channel constants
// ---------------------------------------------------------------------------

export const BRIDGE_CHANNEL_NAMES: readonly BridgeChannelName[] = [
  'telegram',
  'whatsapp',
  'slack',
  'feishu',
  'discord',
  'dingtalk',
  'email',
  'mochat',
  'qq',
];

const LEGACY_REQUIRED_CHANNELS: readonly BridgeChannelName[] = [
  'telegram',
  'whatsapp',
  'slack',
];

// ---------------------------------------------------------------------------
// Generic object readers
// ---------------------------------------------------------------------------

type JsonValue = string | number | boolean | null | JsonObject | JsonValue[];
type JsonObject = { [key: string]: JsonValue };

function readObject(parent: JsonObject, key: string, path: string): JsonObject {
  const value = parent[key];
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as JsonObject;
  }
  throw new Error(`Invalid bridge health payload: ${path}.${key} must be object`);
}

function readBoolean(parent: JsonObject, key: string, path: string): boolean {
  const value = parent[key];
  if (typeof value === 'boolean') {
    return value;
  }
  throw new Error(`Invalid bridge health payload: ${path}.${key} must be boolean`);
}

function readString(parent: JsonObject, key: string, path: string): string {
  const value = parent[key];
  if (typeof value === 'string') {
    return value;
  }
  throw new Error(`Invalid bridge health payload: ${path}.${key} must be string`);
}

function readOptionalString(
  parent: JsonObject,
  key: string,
  path: string,
): string | undefined {
  const value = parent[key];
  if (value === undefined || value === null) return undefined;
  if (typeof value === 'string') return value;
  throw new Error(
    `Invalid bridge health payload: ${path}.${key} must be string when provided`,
  );
}

function readChannelState(
  channels: JsonObject,
  channel: BridgeChannelName,
): boolean {
  const value = channels[channel];
  if (value === undefined && !LEGACY_REQUIRED_CHANNELS.includes(channel)) {
    return false;
  }
  if (typeof value === 'boolean') {
    return value;
  }
  throw new Error(
    `Invalid bridge health payload: channels.${channel} must be boolean`,
  );
}

// ---------------------------------------------------------------------------
// Bridge health normalization
// ---------------------------------------------------------------------------

export function normalizeBridgeHealthSnapshot(payload: object): BridgeHealthSnapshot {
  const root = payload as JsonObject;
  const opencode = readObject(root, 'opencode', 'payload');
  const channels = readObject(root, 'channels', 'payload');
  const config = readObject(root, 'config', 'payload');

  const normalizedChannels = BRIDGE_CHANNEL_NAMES.reduce(
    (acc, channel) => {
      acc[channel] = readChannelState(channels, channel);
      return acc;
    },
    {
      telegram: false,
      whatsapp: false,
      slack: false,
      feishu: false,
      discord: false,
      dingtalk: false,
      email: false,
      mochat: false,
      qq: false,
    } as BridgeChannelsHealth,
  );

  return {
    ok: readBoolean(root, 'ok', 'payload'),
    opencode: {
      url: readString(opencode, 'url', 'payload.opencode'),
      healthy: readBoolean(opencode, 'healthy', 'payload.opencode'),
      version: readOptionalString(opencode, 'version', 'payload.opencode'),
    },
    channels: normalizedChannels,
    config: {
      groupsEnabled: readBoolean(config, 'groupsEnabled', 'payload.config'),
    },
  };
}
