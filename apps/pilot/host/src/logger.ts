/**
 * @license
 * Copyright 2026 cofy-x
 * SPDX-License-Identifier: Apache-2.0
 */

import { hostname } from 'node:os';

import type {
  LogAttributes,
  LogEvent,
  LogFormat,
  LogLevel,
  Logger,
  LoggerChild,
  OtelResourceAttributeInput,
} from './types/index.js';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const LOG_LEVEL_NUMBERS: { [K in LogLevel]: number } = {
  debug: 5,
  info: 9,
  warn: 13,
  error: 17,
};

const ANSI = {
  reset: '\x1b[0m',
  gray: '\x1b[90m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  green: '\x1b[32m',
  cyan: '\x1b[36m',
  magenta: '\x1b[35m',
} as const;

const COMPONENT_COLORS = new Map<string, string>([
  ['pilot', ANSI.gray],
  ['opencode', ANSI.cyan],
  ['pilot-server', ANSI.green],
  ['bridge', ANSI.magenta],
  ['pilot-router', ANSI.cyan],
]);

const LEVEL_COLORS: { [K in LogLevel]: string } = {
  debug: ANSI.gray,
  info: ANSI.gray,
  warn: ANSI.yellow,
  error: ANSI.red,
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function colorize(input: string, color: string, enabled: boolean): string {
  if (!enabled) return input;
  return `${color}${input}${ANSI.reset}`;
}

function toUnixNano(): string {
  return (BigInt(Date.now()) * 1_000_000n).toString();
}

export function mergeResourceAttributes(
  additional: OtelResourceAttributeInput,
  existing?: string,
): string {
  const entries = new Map<string, string>();
  if (existing) {
    for (const part of existing.split(',')) {
      const trimmed = part.trim();
      if (!trimmed) continue;
      const [key, ...rest] = trimmed.split('=');
      if (!key || rest.length === 0) continue;
      entries.set(key, rest.join('=').replace(/,/g, ';'));
    }
  }
  for (const [key, value] of Object.entries(additional)) {
    if (key) {
      entries.set(key, value.replace(/,/g, ';'));
    }
  }
  return Array.from(entries.entries())
    .map(([k, v]) => `${k}=${v}`)
    .join(',');
}

// ---------------------------------------------------------------------------
// OTel log line detection
// ---------------------------------------------------------------------------

interface OtelLogLineCandidate {
  timeUnixNano?: string;
  severityText?: string;
}

export function looksLikeOtelLogLine(line: string): boolean {
  const trimmed = line.trim();
  if (!trimmed.startsWith('{') || !trimmed.endsWith('}')) return false;
  try {
    const parsed = JSON.parse(trimmed) as OtelLogLineCandidate;
    return (
      typeof parsed.timeUnixNano === 'string' &&
      typeof parsed.severityText === 'string'
    );
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Logger factory
// ---------------------------------------------------------------------------

export interface CreateLoggerOptions {
  format: LogFormat;
  runId: string;
  serviceName: string;
  serviceVersion?: string;
  output?: 'stdout' | 'silent';
  color?: boolean;
  onLog?: (event: LogEvent) => void;
}

interface OtelResource {
  'service.name': string;
  'service.instance.id': string;
  'service.version'?: string;
  'host.name'?: string;
}

export function createLogger(options: CreateLoggerOptions): Logger {
  const host = hostname().trim();
  const resource: OtelResource = {
    'service.name': options.serviceName,
    'service.instance.id': options.runId,
  };
  if (options.serviceVersion) {
    resource['service.version'] = options.serviceVersion;
  }
  if (host) {
    resource['host.name'] = host;
  }
  const baseAttributes: LogAttributes = {
    'run.id': options.runId,
    'process.pid': process.pid,
  };
  const output = options.output ?? 'stdout';
  const colorEnabled = options.color ?? false;

  const emit = (
    level: LogLevel,
    message: string,
    attributes?: LogAttributes,
    component?: string,
  ) => {
    const mergedAttributes: LogAttributes = {
      ...baseAttributes,
      ...(component ? { 'service.component': component } : {}),
      ...(attributes ?? {}),
    };
    options.onLog?.({
      time: Date.now(),
      level,
      message,
      component,
      attributes: mergedAttributes,
    });
    if (output === 'silent') return;
    if (options.format === 'json') {
      const record = {
        timeUnixNano: toUnixNano(),
        severityText: level.toUpperCase(),
        severityNumber: LOG_LEVEL_NUMBERS[level],
        body: message,
        attributes: mergedAttributes,
        resource,
      };
      process.stdout.write(`${JSON.stringify(record)}\n`);
      return;
    }
    const label = component ?? options.serviceName;
    const tagLabel = label ? `[${label}]` : '';
    const levelTag = level === 'info' ? '' : level.toUpperCase();
    const coloredLabel = tagLabel
      ? colorize(
          tagLabel,
          COMPONENT_COLORS.get(label) ?? ANSI.gray,
          colorEnabled,
        )
      : '';
    const coloredLevel = levelTag
      ? colorize(levelTag, LEVEL_COLORS[level], colorEnabled)
      : '';
    const tag = [coloredLabel, coloredLevel].filter(Boolean).join(' ');
    const line = tag ? `${tag} ${message}` : message;
    process.stdout.write(`${line}\n`);
  };

  const child = (
    component: string,
    attributes?: LogAttributes,
  ): LoggerChild => ({
    log: (level, message, attrs) =>
      emit(
        level,
        message,
        { ...(attributes ?? {}), ...(attrs ?? {}) },
        component,
      ),
    debug: (message, attrs) =>
      emit(
        'debug',
        message,
        { ...(attributes ?? {}), ...(attrs ?? {}) },
        component,
      ),
    info: (message, attrs) =>
      emit(
        'info',
        message,
        { ...(attributes ?? {}), ...(attrs ?? {}) },
        component,
      ),
    warn: (message, attrs) =>
      emit(
        'warn',
        message,
        { ...(attributes ?? {}), ...(attrs ?? {}) },
        component,
      ),
    error: (message, attrs) =>
      emit(
        'error',
        message,
        { ...(attributes ?? {}), ...(attrs ?? {}) },
        component,
      ),
  });

  return {
    format: options.format,
    output,
    log: emit,
    debug: (message, attrs, component) =>
      emit('debug', message, attrs, component),
    info: (message, attrs, component) =>
      emit('info', message, attrs, component),
    warn: (message, attrs, component) =>
      emit('warn', message, attrs, component),
    error: (message, attrs, component) =>
      emit('error', message, attrs, component),
    child,
  };
}

// ---------------------------------------------------------------------------
// Verbose logger
// ---------------------------------------------------------------------------

export function createVerboseLogger(
  enabled: boolean,
  logger?: Logger,
  component = 'pilot',
): (message: string) => void {
  return (message: string) => {
    if (!enabled) return;
    if (logger) {
      logger.debug(message, undefined, component);
      return;
    }
    process.stdout.write(`[${component}] ${message}\n`);
  };
}
