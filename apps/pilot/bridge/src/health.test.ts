/**
 * @license
 * Copyright 2026 cofy-x
 * SPDX-License-Identifier: Apache-2.0
 */

import http from 'node:http';
import { Readable } from 'node:stream';

import pino from 'pino';
import { afterEach, describe, expect, test, vi } from 'vitest';

import { startHealthServer } from './health.js';
import type { HealthHandlers, HealthSnapshot } from './types/index.js';

interface MockResponseResult {
  status: number;
  body: string;
}

interface MockResponseHandle {
  response: http.ServerResponse;
  done: Promise<MockResponseResult>;
}

const TEST_SNAPSHOT: HealthSnapshot = {
  ok: true,
  opencode: {
    url: 'http://127.0.0.1:4096',
    healthy: true,
    version: '0.0.0-test',
  },
  channels: {
    telegram: true,
    whatsapp: true,
    slack: false,
    feishu: false,
    discord: false,
    dingtalk: false,
    email: false,
    mochat: false,
    qq: false,
  },
  config: {
    groupsEnabled: true,
  },
};

afterEach(() => {
  vi.restoreAllMocks();
});

function createMockRequest(
  method: string,
  url: string,
  body?: string,
  headers: http.IncomingHttpHeaders = {},
): http.IncomingMessage {
  const stream = Readable.from(body === undefined ? [] : [body]);
  return Object.assign(stream, { method, url, headers }) as http.IncomingMessage;
}

function createMockResponse(): MockResponseHandle {
  let status = 0;
  let payload = '';
  let doneResolve: ((result: MockResponseResult) => void) | null = null;

  const done = new Promise<MockResponseResult>((resolve) => {
    doneResolve = resolve;
  });

  const response = {
    setHeader: vi.fn(),
    writeHead: vi.fn((nextStatus: number) => {
      status = nextStatus;
    }),
    end: vi.fn((chunk?: unknown) => {
      payload = chunk === undefined ? '' : String(chunk);
      doneResolve?.({
        status,
        body: payload,
      });
    }),
  } as unknown as http.ServerResponse;

  return { response, done };
}

async function invokeRoute(input: {
  method: string;
  url: string;
  body?: string;
  handlers?: HealthHandlers;
}): Promise<MockResponseResult> {
  let requestHandler:
    | ((req: http.IncomingMessage, res: http.ServerResponse) => void)
    | null = null;

  const mockServer = {
    listen: vi.fn((_port: number, _host: string, onListen?: () => void) => {
      onListen?.();
    }),
    close: vi.fn(),
  } as unknown as http.Server;

  const createServerSpy = vi
    .spyOn(http, 'createServer')
    .mockImplementation(
      ((...args: unknown[]) => {
        const handler = args[0];
        if (typeof handler === 'function') {
          requestHandler = handler as (
            req: http.IncomingMessage,
            res: http.ServerResponse,
          ) => void;
        }
        return mockServer;
      }) as unknown as typeof http.createServer,
    );

  try {
    const stop = startHealthServer(
      18080,
      () => TEST_SNAPSHOT,
      pino({ enabled: false }),
      input.handlers,
    );
    if (!requestHandler) {
      throw new Error('Expected health request handler');
    }

    const { response, done } = createMockResponse();
    const handleRequest = requestHandler as (
      req: http.IncomingMessage,
      res: http.ServerResponse,
    ) => void;
    handleRequest(
      createMockRequest(
        input.method,
        input.url,
        input.body,
        input.body === undefined ? {} : { 'content-type': 'application/json' },
      ),
      response,
    );

    const result = await done;
    stop();
    return result;
  } finally {
    createServerSpy.mockRestore();
  }
}

describe('health server routes', () => {
  test('returns 400 when request body is invalid JSON', async () => {
    const setTelegramToken = vi.fn(async () => ({
      configured: true,
      enabled: true,
    }));

    const result = await invokeRoute({
      method: 'POST',
      url: '/config/telegram-token',
      body: '{"token":',
      handlers: { setTelegramToken },
    });

    expect(result.status).toBe(400);
    expect(JSON.parse(result.body)).toEqual({
      ok: false,
      error: 'Invalid JSON payload',
    });
    expect(setTelegramToken).not.toHaveBeenCalled();
  });

  test('returns 400 when request schema is invalid', async () => {
    const setTelegramToken = vi.fn(async () => ({
      configured: true,
      enabled: true,
    }));

    const result = await invokeRoute({
      method: 'POST',
      url: '/config/telegram-token',
      body: '{}',
      handlers: { setTelegramToken },
    });

    expect(result.status).toBe(400);
    expect(JSON.parse(result.body)).toEqual({
      ok: false,
      error: 'Token is required',
    });
    expect(setTelegramToken).not.toHaveBeenCalled();
  });

  test('returns 413 when request body exceeds max size', async () => {
    const setGroupsEnabled = vi.fn(async () => ({
      groupsEnabled: true,
    }));

    const result = await invokeRoute({
      method: 'POST',
      url: '/config/groups',
      body: 'x'.repeat(1024 * 1024 + 16),
      handlers: { setGroupsEnabled },
    });

    expect(result.status).toBe(413);
    expect(JSON.parse(result.body)).toEqual({
      ok: false,
      error: 'Payload too large',
    });
    expect(setGroupsEnabled).not.toHaveBeenCalled();
  });

  test('returns 500 when handler throws', async () => {
    const setSlackTokens = vi.fn(async () => {
      throw new Error('set slack failed');
    });

    const result = await invokeRoute({
      method: 'POST',
      url: '/config/slack-tokens',
      body: JSON.stringify({ botToken: 'xoxb-test', appToken: 'xapp-test' }),
      handlers: { setSlackTokens },
    });

    expect(result.status).toBe(500);
    expect(setSlackTokens).toHaveBeenCalledTimes(1);
    expect(JSON.parse(result.body)).toEqual({
      ok: false,
      error: 'Error: set slack failed',
    });
  });
});
