/**
 * @license
 * Copyright 2026 cofy-x
 * SPDX-License-Identifier: Apache-2.0
 */

import { afterEach, describe, expect, test, vi } from 'vitest';
import { proxyOpencodeRequest } from './opencode-proxy.js';
import type { WorkspaceInfo } from '../types/index.js';

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
});

describe('proxyOpencodeRequest', () => {
  test('forwards only allowlisted headers and injects workspace auth', async () => {
    const fetchSpy = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );
    globalThis.fetch = fetchSpy;

    const workspace: WorkspaceInfo = {
      id: 'ws_test',
      name: 'test',
      path: '/tmp/workspace',
      workspaceType: 'local',
      baseUrl: 'http://127.0.0.1:4096',
      opencodeUsername: 'pilot',
      opencodePassword: 'secret',
    };

    const request = new Request('http://localhost/opencode/chat', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer client-token',
        Cookie: 'session=1',
        Origin: 'http://localhost:3000',
        'Content-Type': 'application/json',
        'X-Request-Id': 'req-1',
      },
      body: JSON.stringify({ message: 'hello' }),
    });

    await proxyOpencodeRequest({
      request,
      url: new URL(request.url),
      workspace,
    });

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const firstCall = fetchSpy.mock.calls[0];
    if (!firstCall) {
      throw new Error('Expected proxy fetch to be called');
    }
    const [, init] = firstCall;
    const headers = new Headers(init?.headers);

    expect(headers.get('authorization')).toMatch(/^Basic\s+/);
    expect(headers.get('x-request-id')).toBe('req-1');
    expect(headers.get('content-type')).toBe('application/json');
    expect(headers.get('cookie')).toBeNull();
    expect(headers.get('origin')).toBeNull();
  });

  test('sets duplex when forwarding stream request body', async () => {
    const fetchSpy = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );
    globalThis.fetch = fetchSpy;

    const workspace: WorkspaceInfo = {
      id: 'ws_test',
      name: 'test',
      path: '/tmp/workspace',
      workspaceType: 'local',
      baseUrl: 'http://127.0.0.1:4096',
    };

    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(new TextEncoder().encode('{"message":"hello"}'));
        controller.close();
      },
    });
    const request = new Request('http://localhost/opencode/chat', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: stream,
      duplex: 'half',
    });

    await proxyOpencodeRequest({
      request,
      url: new URL(request.url),
      workspace,
    });

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const firstCall = fetchSpy.mock.calls[0];
    if (!firstCall) {
      throw new Error('Expected proxy fetch to be called');
    }
    const [, init] = firstCall;
    expect(init?.duplex).toBe('half');
  });
});
