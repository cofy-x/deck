/**
 * @license
 * Copyright 2026 cofy-x
 * SPDX-License-Identifier: Apache-2.0
 */

import { afterEach, describe, expect, test, vi } from 'vitest';
import { updateBridgeTelegramToken } from './bridge.service.js';

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
  delete process.env['BRIDGE_HEALTH_PORT'];
});

describe('bridge service', () => {
  test('tries loopback hosts only when updating telegram token', async () => {
    const calls: string[] = [];
    globalThis.fetch = vi
      .fn<typeof fetch>()
      .mockImplementationOnce(async (url) => {
        calls.push(String(url));
        throw new Error('loopback v4 unavailable');
      })
      .mockImplementationOnce(async (url) => {
        calls.push(String(url));
        return new Response(JSON.stringify({ ok: true }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        });
      });

    process.env['BRIDGE_HEALTH_PORT'] = '3999';
    await updateBridgeTelegramToken('telegram-token');

    expect(calls).toEqual([
      'http://127.0.0.1:3999/config/telegram-token',
      'http://[::1]:3999/config/telegram-token',
    ]);
  });
});
