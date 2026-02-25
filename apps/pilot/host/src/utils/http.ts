/**
 * @license
 * Copyright 2026 cofy-x
 * SPDX-License-Identifier: Apache-2.0
 */

import { pollUntil } from './poll.js';

// ---------------------------------------------------------------------------
// Error message extraction from HTTP responses
// ---------------------------------------------------------------------------

interface ErrorResponseBody {
  message?: string;
}

function extractErrorMessage(value: object | null): string | undefined {
  if (!value || !('message' in value)) return undefined;
  const body = value as ErrorResponseBody;
  return typeof body.message === 'string' ? body.message : undefined;
}

// ---------------------------------------------------------------------------
// Typed JSON fetch
// ---------------------------------------------------------------------------

export async function fetchJson<T>(
  url: string,
  init?: RequestInit,
): Promise<T> {
  const response = await fetch(url, init);
  let payload: T | null = null;
  try {
    payload = (await response.json()) as T;
  } catch {
    payload = null;
  }
  if (!response.ok) {
    const message = extractErrorMessage(payload as object | null);
    throw new Error(`HTTP ${response.status}${message ? ` ${message}` : ''}`);
  }
  if (!payload) {
    throw new Error(`Empty response from ${url}`);
  }
  return payload;
}

// ---------------------------------------------------------------------------
// Generic health polling
// ---------------------------------------------------------------------------

export async function waitForHealthy(
  url: string,
  timeoutMs = 10_000,
  pollMs = 250,
): Promise<void> {
  await pollUntil({
    timeoutMs,
    intervalMs: pollMs,
    timeoutMessage: 'Timed out waiting for health check',
    attempt: async () => {
      const response = await fetch(`${url.replace(/\/$/, '')}/health`);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      return true;
    },
  });
}

// ---------------------------------------------------------------------------
// Output formatting
// ---------------------------------------------------------------------------

export function outputResult(payload: string | object, json: boolean): void {
  if (json) {
    process.stdout.write(`${JSON.stringify(payload, null, 2)}\n`);
    return;
  }
  if (typeof payload === 'string') {
    process.stdout.write(`${payload}\n`);
    return;
  }
  process.stdout.write(`${JSON.stringify(payload, null, 2)}\n`);
}

export function outputError(error: Error | string, json: boolean): void {
  const message = error instanceof Error ? error.message : error;
  if (json) {
    process.stdout.write(
      `${JSON.stringify({ ok: false, error: message }, null, 2)}\n`,
    );
    return;
  }
  process.stderr.write(`${message}\n`);
}
