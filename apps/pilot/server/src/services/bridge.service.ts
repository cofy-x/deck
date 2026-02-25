/**
 * @license
 * Copyright 2026 cofy-x
 * SPDX-License-Identifier: Apache-2.0
 */

import { join } from 'node:path';
import { homedir } from 'node:os';
import type { JsonObject, JsonValue } from '../types/index.js';
import { ApiError } from '../errors.js';
import { expandHome, parseInteger, parseJsonResponse } from '../utils/parse.js';

function isBridgeDebugEnabled(): boolean {
  return ['1', 'true', 'yes'].includes(
    (process.env['PILOT_DEBUG_BRIDGE'] ?? '').toLowerCase(),
  );
}

export function logBridgeDebug(message: string, details?: JsonObject): void {
  if (!isBridgeDebugEnabled()) return;
  const payload = details ? ` ${JSON.stringify(details)}` : '';
  console.log(`[bridge] ${message}${payload}`);
}

export function resolveBridgeConfigPath(): string {
  const override = process.env['BRIDGE_CONFIG_PATH']?.trim();
  if (override) return expandHome(override);
  const dataDir =
    process.env['BRIDGE_DATA_DIR']?.trim() ||
    join(homedir(), '.deck', 'pilot', 'bridge');
  return join(expandHome(dataDir), 'bridge.json');
}

function resolveBridgeHealthPort(): number {
  return parseInteger(process.env['BRIDGE_HEALTH_PORT']) ?? 3005;
}

async function callBridgeEndpoint(
  endpoint: string,
  body: JsonObject,
  healthPortOverride?: number | null,
): Promise<JsonObject> {
  const port = healthPortOverride ?? resolveBridgeHealthPort();
  const candidates = ['127.0.0.1', '::1'];
  let response: globalThis.Response | null = null;
  let lastError: Error | null = null;

  for (const host of candidates) {
    const normalizedHost = host.includes(':') ? `[${host}]` : host;
    const url = `http://${normalizedHost}:${port}${endpoint}`;
    try {
      response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      break;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
    }
  }

  if (!response) {
    throw new ApiError(
      502,
      'bridge_unreachable',
      'Bridge health server is unavailable',
      {
        error: lastError ? String(lastError) : 'no response',
        port,
        hosts: candidates,
      },
    );
  }

  const text = await response.text();
  const parsed: JsonValue = parseJsonResponse(text);

  if (!response.ok) {
    const detail =
      typeof parsed === 'object' && parsed && 'error' in parsed
        ? String((parsed as JsonObject)['error'])
        : 'Bridge request failed';
    throw new ApiError(response.status, 'bridge_request_failed', detail, {
      status: response.status,
      body: parsed,
    });
  }

  if (parsed && typeof parsed === 'object') {
    return parsed as JsonObject;
  }
  return { ok: true };
}

export async function updateBridgeTelegramToken(
  token: string,
  healthPortOverride?: number | null,
): Promise<JsonObject> {
  return callBridgeEndpoint(
    '/config/telegram-token',
    { token },
    healthPortOverride,
  );
}

export async function updateBridgeSlackTokens(
  botToken: string,
  appToken: string,
  healthPortOverride?: number | null,
): Promise<JsonObject> {
  return callBridgeEndpoint(
    '/config/slack-tokens',
    { botToken, appToken },
    healthPortOverride,
  );
}
