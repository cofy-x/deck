/**
 * @license
 * Copyright 2026 cofy-x
 * SPDX-License-Identifier: Apache-2.0
 */

import { createOpencodeClient } from '@opencode-ai/sdk/v2/client';
import { z } from 'zod';

import type {
  BridgeHealthSnapshot,
  HttpHeaders,
  OpencodeHealthData,
} from '../types/index.js';
import { normalizeBridgeHealthSnapshot } from '../utils/bridge-health.js';
import { fetchJson } from '../utils/http.js';
import { pollUntil } from '../utils/poll.js';

export type OpencodeClient = ReturnType<typeof createOpencodeClient>;

interface CreateOpencodeSdkClientOptions {
  baseUrl: string;
  directory?: string;
  headers?: HttpHeaders;
}

const opencodeHealthSchema = z.object({
  data: z
    .object({
      healthy: z.boolean(),
    })
    .optional(),
});

const objectPayloadSchema = z.record(z.string(), z.unknown());

export function createOpencodeSdkClient(
  options: CreateOpencodeSdkClientOptions,
): OpencodeClient {
  return createOpencodeClient({
    baseUrl: options.baseUrl,
    directory: options.directory,
    headers: options.headers,
  });
}

export async function waitForOpencodeHealthy(
  client: OpencodeClient,
  timeoutMs = 10_000,
  pollMs = 250,
): Promise<OpencodeHealthData> {
  return pollUntil({
    timeoutMs,
    intervalMs: pollMs,
    timeoutMessage: 'Timed out waiting for OpenCode health',
    attempt: async () => {
      const raw = (await client.global.health()) as unknown;
      const parsed = opencodeHealthSchema.safeParse(raw);
      if (!parsed.success) {
        throw new Error('Invalid OpenCode health response payload');
      }
      if (!parsed.data.data?.healthy) {
        throw new Error('Server reported unhealthy');
      }
      return parsed.data.data;
    },
  });
}

export async function fetchBridgeHealth(
  baseUrl: string,
): Promise<BridgeHealthSnapshot> {
  const payload = await fetchJson<unknown>(`${baseUrl.replace(/\/$/, '')}/health`);
  const parsed = objectPayloadSchema.safeParse(payload);
  if (!parsed.success) {
    throw new Error('Invalid bridge health payload: expected object');
  }
  return normalizeBridgeHealthSnapshot(parsed.data);
}

export async function waitForBridgeHealthy(
  baseUrl: string,
  timeoutMs = 10_000,
  pollMs = 500,
): Promise<BridgeHealthSnapshot> {
  return pollUntil({
    timeoutMs,
    intervalMs: pollMs,
    timeoutMessage: 'Timed out waiting for bridge health',
    attempt: async () => {
      const response = await fetch(`${baseUrl.replace(/\/$/, '')}/health`);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      const payload = await response.json();
      const parsed = objectPayloadSchema.safeParse(payload);
      if (!parsed.success) {
        throw new Error('Invalid bridge health payload: expected object');
      }
      return normalizeBridgeHealthSnapshot(parsed.data);
    },
  });
}
