/**
 * @license
 * Copyright 2025 cofy-x
 * SPDX-License-Identifier: Apache-2.0
 */

import type { Command } from 'commander';

import { CHANNEL_LABELS } from '../channel-meta.js';
import {
  normalizeWhatsAppId,
  readConfigFile,
  writeConfigFile,
} from '../config.js';
import { createLogger } from '../logger.js';
import { parseJsonObject, parseJsonText, parseJsonValue } from '../safe-json.js';
import type {
  BridgeReporter,
  ChannelName,
  Config,
  ConfigFile,
  JsonObject,
  JsonValue,
} from '../types/index.js';
import { truncateText } from '../text.js';

// ---------------------------------------------------------------------------
// Program options type
// ---------------------------------------------------------------------------

export interface ProgramOptions {
  json: boolean;
}

export function getOpts(program: Command): ProgramOptions {
  return program.opts() as ProgramOptions;
}

// ---------------------------------------------------------------------------
// JSON output
// ---------------------------------------------------------------------------

export function outputJson(data: JsonValue) {
  console.log(JSON.stringify(data, null, 2));
}

// ---------------------------------------------------------------------------
// Logger factory
// ---------------------------------------------------------------------------

export function createAppLogger(config: Config) {
  return createLogger(config.logLevel, { logFile: config.logFile });
}

// ---------------------------------------------------------------------------
// Console reporter for start command
// ---------------------------------------------------------------------------

export function createConsoleReporter(): BridgeReporter {
  const formatChannel = (channel: ChannelName): string => CHANNEL_LABELS[channel];
  const formatPeer = (
    channel: ChannelName,
    peerId: string,
    fromMe?: boolean,
  ) => {
    const base = channel === 'whatsapp' ? normalizeWhatsAppId(peerId) : peerId;
    return fromMe ? `${base} (me)` : base;
  };

  const printBlock = (prefix: string, text: string) => {
    const lines = text
      .split(/\r?\n/)
      .map((line) => truncateText(line.trim(), 240));
    const [first, ...rest] = lines.length ? lines : ['(empty)'];
    console.log(`${prefix} ${first}`);
    for (const line of rest) {
      console.log(`${' '.repeat(prefix.length)} ${line}`);
    }
  };

  return {
    onStatus(message) {
      console.log(message);
    },
    onInbound({ channel, peerId, text, fromMe }) {
      const prefix = `[${formatChannel(channel)}] ${formatPeer(channel, peerId, fromMe)} >`;
      printBlock(prefix, text);
    },
    onOutbound({ channel, peerId, text, kind }) {
      const marker = kind === 'reply' ? '<' : kind === 'tool' ? '*' : '!';
      const prefix = `[${formatChannel(channel)}] ${formatPeer(channel, peerId)} ${marker}`;
      printBlock(prefix, text);
    },
  };
}

// ---------------------------------------------------------------------------
// Config file helpers
// ---------------------------------------------------------------------------

export function updateConfig(
  configPath: string,
  updater: (cfg: ConfigFile) => ConfigFile,
): ConfigFile {
  const { config } = readConfigFile(configPath);
  const base = config ?? { version: 1 };
  const next = updater(base);
  next.version = next.version ?? 1;
  writeConfigFile(configPath, next);
  return next;
}

export function getNestedValue(obj: JsonObject, keyPath: string): JsonValue {
  const keys = keyPath.split('.');
  let current: JsonValue = obj;
  for (const key of keys) {
    if (
      current === null ||
      current === undefined ||
      typeof current !== 'object'
    ) {
      return undefined;
    }
    current = (current as JsonObject)[key];
  }
  return current;
}

export function setNestedValue(
  obj: JsonObject,
  keyPath: string,
  value: JsonValue,
): void {
  const keys = keyPath.split('.');
  let current: JsonObject = obj;
  for (let i = 0; i < keys.length - 1; i++) {
    const key = keys[i];
    if (
      current[key] === undefined ||
      current[key] === null ||
      typeof current[key] !== 'object'
    ) {
      current[key] = {};
    }
    current = current[key] as JsonObject;
  }
  current[keys[keys.length - 1]] = value;
}

export function parseConfigValue(value: string): JsonValue {
  try {
    const parsed = parseJsonText(value, 'config value');
    return parseJsonValue(parsed, 'config value');
  } catch {
    return value;
  }
}

export function toJsonObject(value: unknown, context: string): JsonObject {
  return parseJsonObject(value, context);
}
