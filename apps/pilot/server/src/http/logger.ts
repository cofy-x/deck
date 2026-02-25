/**
 * @license
 * Copyright 2026 cofy-x
 * SPDX-License-Identifier: Apache-2.0
 */

import { hostname } from 'node:os';
import type { AuthMode, JsonObject, ServerConfig } from '../types/index.js';
import { shortId } from '../utils/crypto.js';

export const SERVER_VERSION = '0.0.1';

type LogLevel = 'info' | 'warn' | 'error';

type LogAttributes = JsonObject;

export interface ServerLogger {
  log: (level: LogLevel, message: string, attributes?: LogAttributes) => void;
}

const LOG_LEVEL_NUMBERS: Record<LogLevel, number> = {
  info: 9,
  warn: 13,
  error: 17,
};

function toUnixNano(): string {
  return (BigInt(Date.now()) * 1_000_000n).toString();
}

export function createServerLogger(config: ServerConfig): ServerLogger {
  const runId = process.env['PILOT_RUN_ID'] ?? shortId();
  const host = hostname().trim();
  const resource: Record<string, string> = {
    'service.name': 'pilot-server',
    'service.version': SERVER_VERSION,
    'service.instance.id': runId,
  };
  if (host) {
    resource['host.name'] = host;
  }
  const baseAttributes: LogAttributes = {
    'run.id': runId,
    'process.pid': process.pid,
  };

  const emit = (
    level: LogLevel,
    message: string,
    attributes?: LogAttributes,
  ) => {
    const merged = { ...baseAttributes, ...(attributes ?? {}) };
    if (config.logFormat === 'json') {
      const record = {
        timeUnixNano: toUnixNano(),
        severityText: level.toUpperCase(),
        severityNumber: LOG_LEVEL_NUMBERS[level],
        body: message,
        attributes: merged,
        resource,
      };
      process.stdout.write(`${JSON.stringify(record)}\n`);
      return;
    }
    process.stdout.write(`${message}\n`);
  };

  return { log: emit };
}

export interface LogRequestInput {
  logger: ServerLogger;
  request: Request;
  response: Response;
  durationMs: number;
  authMode: AuthMode;
  proxyBaseUrl?: string;
  error?: string;
}

export function logRequest(input: LogRequestInput): void {
  const {
    logger,
    request,
    response,
    durationMs,
    authMode,
    proxyBaseUrl,
    error,
  } = input;
  const status = response.status;
  const level: LogLevel =
    status >= 500 ? 'error' : status >= 400 ? 'warn' : 'info';
  const url = new URL(request.url);
  const method = request.method.toUpperCase();
  const message = `${method} ${url.pathname} ${status} ${durationMs}ms${proxyBaseUrl ? ' (opencode)' : ''}`;
  const attributes: LogAttributes = {
    method,
    path: url.pathname,
    status,
    durationMs,
    auth: authMode,
  };
  if (proxyBaseUrl) {
    attributes['opencode.base_url'] = proxyBaseUrl;
  }
  if (error) {
    attributes['error'] = error;
  }
  logger.log(level, message, attributes);
}
