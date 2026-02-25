/**
 * @license
 * Copyright 2026 cofy-x
 * SPDX-License-Identifier: Apache-2.0
 */

import { createHmac } from 'node:crypto';

import pino from 'pino';
import { afterEach, describe, expect, test, vi } from 'vitest';

import { createAdapterTestConfig } from '../test-fixtures.js';
import { createDingTalkAdapter, extractVerificationToken } from './dingtalk.js';

describe('createDingTalkAdapter', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  test('sendText uses plain webhook URL when signing secret is not configured', async () => {
    const fetchMock = vi.fn(
      async (_input: string | URL, _init?: RequestInit) => ({
        ok: true,
        status: 200,
        text: async () => '',
      }) as Response,
    );
    vi.stubGlobal('fetch', fetchMock);

    const config = createAdapterTestConfig({
      dingtalkWebhookUrl:
        'https://oapi.dingtalk.com/robot/send?access_token=plain-token',
      dingtalkSignSecret: undefined,
    });
    const adapter = createDingTalkAdapter(
      config,
      pino({ enabled: false }),
      async () => undefined,
    );

    await adapter.sendText('peer', 'hello');

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith(
      'https://oapi.dingtalk.com/robot/send?access_token=plain-token',
      expect.objectContaining({
        method: 'POST',
      }),
    );
  });

  test('sendText appends timestamp and sign when signing secret is configured', async () => {
    const fetchMock = vi.fn(
      async (_input: string | URL, _init?: RequestInit) => ({
        ok: true,
        status: 200,
        text: async () => '',
      }) as Response,
    );
    vi.stubGlobal('fetch', fetchMock);
    vi.spyOn(Date, 'now').mockReturnValue(1_700_000_000_000);

    const signSecret = 'this is secret';
    const config = createAdapterTestConfig({
      dingtalkWebhookUrl:
        'https://oapi.dingtalk.com/robot/send?access_token=signed-token',
      dingtalkSignSecret: signSecret,
    });
    const adapter = createDingTalkAdapter(
      config,
      pino({ enabled: false }),
      async () => undefined,
    );

    await adapter.sendText('peer', 'hello');

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const firstCall = fetchMock.mock.calls[0];
    expect(firstCall).toBeDefined();
    const parsedUrl = new URL(String(firstCall?.[0]));
    const timestamp = '1700000000000';
    const expectedSign = createHmac('sha256', signSecret)
      .update(`${timestamp}\n${signSecret}`, 'utf8')
      .digest('base64');

    expect(parsedUrl.searchParams.get('access_token')).toBe('signed-token');
    expect(parsedUrl.searchParams.get('timestamp')).toBe(timestamp);
    expect(parsedUrl.searchParams.get('sign')).toBe(expectedSign);
  });

  test('extractVerificationToken reads token from payload and headers', () => {
    const fromHeader = extractVerificationToken(
      {},
      {
        token: 'header-token',
      },
    );
    expect(fromHeader).toBe('header-token');

    const fromPayload = extractVerificationToken(
      {
        token: 'payload-token',
      },
      {},
    );
    expect(fromPayload).toBe('payload-token');
  });

  test('extractVerificationToken prefers token header over payload token', () => {
    const token = extractVerificationToken(
      {
        token: 'payload-token',
      },
      {
        token: 'plain-token',
      },
    );
    expect(token).toBe('plain-token');
  });
});
