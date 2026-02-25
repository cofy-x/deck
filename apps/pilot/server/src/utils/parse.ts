/**
 * @license
 * Copyright 2026 cofy-x
 * SPDX-License-Identifier: Apache-2.0
 */

import { join } from 'node:path';
import { homedir } from 'node:os';
import type { JsonValue, LogFormat } from '../types/index.js';

export function parseList(input: string | undefined): string[] {
  if (!input) return [];
  const trimmed = input.trim();
  if (!trimmed) return [];
  if (trimmed.startsWith('[')) {
    try {
      const parsed: JsonValue = JSON.parse(trimmed) as JsonValue;
      if (Array.isArray(parsed)) {
        return parsed.map((item: JsonValue) => String(item)).filter(Boolean);
      }
    } catch {
      return [];
    }
  }
  return trimmed
    .split(/[,;]/)
    .map((value) => value.trim())
    .filter(Boolean);
}

export function parseBoolean(value: string | undefined): boolean | undefined {
  if (!value) return undefined;
  const normalized = value.trim().toLowerCase();
  if (['true', '1', 'yes', 'on'].includes(normalized)) return true;
  if (['false', '0', 'no', 'off'].includes(normalized)) return false;
  return undefined;
}

export function parseInteger(value: string | undefined): number | null {
  if (!value) return null;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : null;
}

export function normalizeLogFormat(
  value: string | undefined,
): LogFormat | undefined {
  if (!value) return undefined;
  const normalized = value.trim().toLowerCase();
  if (normalized === 'json') return 'json';
  if (
    normalized === 'pretty' ||
    normalized === 'text' ||
    normalized === 'human'
  )
    return 'pretty';
  return undefined;
}

export function expandHome(value: string): string {
  if (value.startsWith('~/')) {
    return join(homedir(), value.slice(2));
  }
  return value;
}

export function parseJsonResponse(text: string): JsonValue {
  const trimmed = text.trim();
  if (!trimmed) return null;
  try {
    return JSON.parse(trimmed) as JsonValue;
  } catch {
    return trimmed;
  }
}

export function normalizeHealthPort(value: JsonValue): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null;
  const port = Math.trunc(value);
  if (port <= 0 || port > 65535) return null;
  return port;
}
