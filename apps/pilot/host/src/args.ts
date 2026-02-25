/**
 * @license
 * Copyright 2026 cofy-x
 * SPDX-License-Identifier: Apache-2.0
 */

import type {
  ApprovalMode,
  BinarySourcePreference,
  FlagMap,
  FlagValue,
  LogFormat,
  ParsedArgs,
} from './types/index.js';

// ---------------------------------------------------------------------------
// Argument parsing
// ---------------------------------------------------------------------------

export function parseArgs(argv: string[]): ParsedArgs {
  const flags: FlagMap = new Map<string, FlagValue>();
  const positionals: string[] = [];

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (!arg) continue;
    if (arg === '-h') {
      flags.set('help', true);
      continue;
    }
    if (arg === '-v') {
      flags.set('version', true);
      continue;
    }
    if (!arg.startsWith('--')) {
      positionals.push(arg);
      continue;
    }

    const trimmed = arg.slice(2);
    if (!trimmed) continue;

    if (trimmed.startsWith('no-')) {
      flags.set(trimmed.slice(3), false);
      continue;
    }

    const eqIndex = trimmed.indexOf('=');
    if (eqIndex !== -1) {
      const key = trimmed.slice(0, eqIndex);
      const inlineValue = trimmed.slice(eqIndex + 1);
      flags.set(key, inlineValue);
      continue;
    }

    const next = argv[i + 1];
    if (next && !next.startsWith('--')) {
      flags.set(trimmed, next);
      i += 1;
    } else {
      flags.set(trimmed, true);
    }
  }

  return { positionals, flags };
}

// ---------------------------------------------------------------------------
// Flag readers
// ---------------------------------------------------------------------------

export function parseList(value?: string): string[] {
  if (!value) return [];
  const trimmed = value.trim();
  if (!trimmed) return [];
  if (trimmed.startsWith('[')) {
    try {
      const parsed: string[] = JSON.parse(trimmed) as string[];
      if (Array.isArray(parsed)) {
        return parsed.map((item) => String(item)).filter(Boolean);
      }
    } catch {
      return [];
    }
  }
  return trimmed
    .split(/[,;]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

export function readFlag(flags: FlagMap, key: string): string | undefined {
  const value = flags.get(key);
  if (value === undefined || value === null) return undefined;
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  return value;
}

export function readBool(
  flags: FlagMap,
  key: string,
  fallback: boolean,
  envKey?: string,
): boolean {
  const raw = flags.get(key);
  if (raw !== undefined) {
    if (typeof raw === 'boolean') return raw;
    const normalized = String(raw).toLowerCase();
    if (['false', '0', 'no'].includes(normalized)) return false;
    if (['true', '1', 'yes'].includes(normalized)) return true;
  }

  const envValue = envKey ? process.env[envKey] : undefined;
  if (envValue) {
    const normalized = envValue.toLowerCase();
    if (['false', '0', 'no'].includes(normalized)) return false;
    if (['true', '1', 'yes'].includes(normalized)) return true;
  }

  return fallback;
}

export function readNumber(
  flags: FlagMap,
  key: string,
  fallback: number | undefined,
  envKey?: string,
): number | undefined {
  const raw = flags.get(key);
  if (raw !== undefined) {
    const parsed = Number(raw);
    if (!Number.isNaN(parsed)) return parsed;
  }
  if (envKey) {
    const envValue = process.env[envKey];
    if (envValue) {
      const parsed = Number(envValue);
      if (!Number.isNaN(parsed)) return parsed;
    }
  }
  return fallback;
}

interface IntegerReadOptions {
  min?: number;
  max?: number;
}

function parseIntegerValue(raw: FlagValue, key: string): number {
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || !Number.isInteger(parsed)) {
    throw new Error(`Invalid ${key} value: ${String(raw)}. Expected integer.`);
  }
  return parsed;
}

function validateIntegerRange(
  value: number,
  key: string,
  options?: IntegerReadOptions,
): number {
  const min = options?.min;
  const max = options?.max;
  if (min !== undefined && value < min) {
    throw new Error(`Invalid ${key} value: ${value}. Must be >= ${min}.`);
  }
  if (max !== undefined && value > max) {
    throw new Error(`Invalid ${key} value: ${value}. Must be <= ${max}.`);
  }
  return value;
}

export function readInteger(
  flags: FlagMap,
  key: string,
  fallback: number | undefined,
  envKey?: string,
  options?: IntegerReadOptions,
): number | undefined {
  const raw = flags.get(key);
  if (raw !== undefined) {
    return validateIntegerRange(parseIntegerValue(raw, key), key, options);
  }

  if (envKey) {
    const envValue = process.env[envKey];
    if (envValue !== undefined && envValue !== '') {
      return validateIntegerRange(
        parseIntegerValue(envValue, key),
        key,
        options,
      );
    }
  }

  if (fallback === undefined) return undefined;
  if (!Number.isFinite(fallback) || !Number.isInteger(fallback)) {
    throw new Error(`Invalid default ${key} value: ${String(fallback)}.`);
  }
  return validateIntegerRange(fallback, key, options);
}

export function readPort(
  flags: FlagMap,
  key: string,
  fallback: number | undefined,
  envKey?: string,
): number | undefined {
  return readInteger(flags, key, fallback, envKey, { min: 1, max: 65_535 });
}

export function readTimeoutMs(
  flags: FlagMap,
  key: string,
  fallback: number | undefined,
  envKey?: string,
): number | undefined {
  return readInteger(flags, key, fallback, envKey, { min: 1 });
}

export function readBinarySource(
  flags: FlagMap,
  key: string,
  fallback: BinarySourcePreference,
  envKey?: string,
): BinarySourcePreference {
  const raw =
    readFlag(flags, key) ?? (envKey ? process.env[envKey] : undefined);
  if (!raw) return fallback;
  const normalized = String(raw).trim().toLowerCase();
  if (
    normalized === 'auto' ||
    normalized === 'bundled' ||
    normalized === 'downloaded' ||
    normalized === 'external'
  ) {
    return normalized;
  }
  throw new Error(
    `Invalid ${key} value: ${raw}. Use auto|bundled|downloaded|external.`,
  );
}

export function readLogFormat(
  flags: FlagMap,
  key: string,
  fallback: LogFormat,
  envKey?: string,
): LogFormat {
  const raw =
    readFlag(flags, key) ?? (envKey ? process.env[envKey] : undefined);
  if (!raw) return fallback;
  const normalized = String(raw).trim().toLowerCase();
  if (normalized === 'json') return 'json';
  if (
    normalized === 'pretty' ||
    normalized === 'text' ||
    normalized === 'human'
  )
    return 'pretty';
  throw new Error(`Invalid ${key} value: ${raw}. Use pretty|json.`);
}

export function readApprovalMode(
  flags: FlagMap,
  key: string,
  fallback: ApprovalMode,
  envKey?: string,
): ApprovalMode {
  const raw =
    readFlag(flags, key) ?? (envKey ? process.env[envKey] : undefined);
  if (!raw) return fallback;
  const normalized = String(raw).trim().toLowerCase();
  if (normalized === 'auto') return 'auto';
  if (normalized === 'manual') return 'manual';
  throw new Error(`Invalid ${key} value: ${raw}. Use manual|auto.`);
}
