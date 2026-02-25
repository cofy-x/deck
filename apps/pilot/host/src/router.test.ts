/**
 * @license
 * Copyright 2026 cofy-x
 * SPDX-License-Identifier: Apache-2.0
 */

import type { ChildProcess } from 'node:child_process';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { EventEmitter } from 'node:events';
import { Readable } from 'node:stream';
import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import { afterEach, describe, expect, test, vi } from 'vitest';

const servicesMock = vi.hoisted(() => ({
  createOpencodeSdkClient: vi.fn(),
  startOpencode: vi.fn(),
  verifyOpencodeVersion: vi.fn(),
  waitForOpencodeHealthy: vi.fn(),
}));

vi.mock('./services.js', () => servicesMock);

import { createLogger } from './logger.js';
import { createRouterHttpHandler } from './router/http-handler.js';
import { createRouterOpencodeManager } from './router/opencode-manager.js';
import type { RouterState } from './types/index.js';

interface HandlerResponse {
  statusCode: number;
  body: { [key: string]: unknown };
}

function createState(): RouterState {
  return {
    version: 1,
    daemon: undefined,
    opencode: undefined,
    cliVersion: undefined,
    sidecar: undefined,
    binaries: undefined,
    activeId: '',
    workspaces: [],
  };
}

async function invokeHandler(
  handler: (req: IncomingMessage, res: ServerResponse) => Promise<void>,
  input: { method: string; url: string; body?: string },
): Promise<HandlerResponse> {
  const requestBody = input.body ?? '';
  const req = Object.assign(
    Readable.from(requestBody ? [requestBody] : []),
    {
      method: input.method,
      url: input.url,
      headers: {
        'content-type': 'application/json',
      },
    },
  ) as unknown as IncomingMessage;

  const events = new EventEmitter();
  let payload = '';
  const res = events as unknown as ServerResponse;
  (res as { statusCode: number }).statusCode = 200;
  (
    res as unknown as {
      setHeader: (name: string, value: string) => void;
    }
  ).setHeader = () => undefined;
  (
    res as unknown as {
      end: (chunk?: string | Buffer) => void;
    }
  ).end = (chunk?: string | Buffer) => {
    if (chunk) {
      payload += typeof chunk === 'string' ? chunk : chunk.toString('utf8');
    }
    events.emit('finish');
  };
  (
    res as unknown as {
      on: (event: string, listener: (...args: unknown[]) => void) => void;
    }
  ).on = events.on.bind(events) as (
    event: string,
    listener: (...args: unknown[]) => void,
  ) => void;

  await handler(req, res);

  return {
    statusCode: (res as { statusCode: number }).statusCode,
    body: payload ? (JSON.parse(payload) as { [key: string]: unknown }) : {},
  };
}

describe('router http handler', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  test('returns 400 for invalid JSON request body', async () => {
    const state = createState();
    const logger = createLogger({
      format: 'pretty',
      runId: 'router-test-400',
      serviceName: 'pilot',
      output: 'silent',
    });
    const handler = createRouterHttpHandler({
      host: '127.0.0.1',
      port: 8787,
      logger,
      state,
      statePath: join(tmpdir(), 'router-test-state-400.json'),
      ensureOpencode: async () => ({ baseUrl: 'http://127.0.0.1:4096' }),
      shutdown: async () => undefined,
    });

    const response = await invokeHandler(handler, {
      method: 'POST',
      url: '/workspaces',
      body: '{"path":',
    });
    expect(response.statusCode).toBe(400);
    expect(response.body['error']).toBe('invalid JSON body');
  });

  test('returns 502 when upstream dispose endpoint fails', async () => {
    const state = createState();
    state.workspaces = [
      {
        id: 'ws-remote',
        name: 'remote',
        path: '/workspace',
        workspaceType: 'remote',
        baseUrl: 'http://remote.test',
        directory: '/workspace',
        createdAt: Date.now(),
      },
    ];

    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ message: 'boom' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    const logger = createLogger({
      format: 'pretty',
      runId: 'router-test-502',
      serviceName: 'pilot',
      output: 'silent',
    });
    const handler = createRouterHttpHandler({
      host: '127.0.0.1',
      port: 8787,
      logger,
      state,
      statePath: join(tmpdir(), 'router-test-state-502.json'),
      ensureOpencode: async () => ({ baseUrl: 'http://127.0.0.1:4096' }),
      shutdown: async () => undefined,
    });

    const response = await invokeHandler(handler, {
      method: 'POST',
      url: '/instances/ws-remote/dispose',
    });

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(response.statusCode).toBe(502);
    expect(response.body['error']).toBe('upstream dispose failed (HTTP 500) boom');
  });
});

describe('router opencode manager', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    servicesMock.createOpencodeSdkClient.mockReset();
    servicesMock.startOpencode.mockReset();
    servicesMock.verifyOpencodeVersion.mockReset();
    servicesMock.waitForOpencodeHealthy.mockReset();
  });

  test('terminates stale healthy pid before starting a new opencode process', async () => {
    const tempDir = await mkdtemp(join(tmpdir(), 'router-opencode-manager-'));
    const statePath = join(tempDir, 'pilot-state.json');
    const state = createState();
    state.opencode = {
      pid: 456,
      port: 4096,
      baseUrl: 'http://127.0.0.1:4096',
      startedAt: Date.now(),
    };

    servicesMock.createOpencodeSdkClient.mockReturnValue({});
    servicesMock.waitForOpencodeHealthy
      .mockRejectedValueOnce(new Error('unhealthy'))
      .mockResolvedValueOnce({ healthy: true });
    servicesMock.verifyOpencodeVersion.mockResolvedValue('1.2.6');
    servicesMock.startOpencode.mockResolvedValue({
      pid: 789,
      stdout: null,
      stderr: null,
    } as unknown as ChildProcess);

    let staleAlive = true;
    const killSpy = vi
      .spyOn(process, 'kill')
      .mockImplementation(((pid: number, signal?: NodeJS.Signals | number) => {
        if (pid !== 456) return true;
        if (signal === 0) {
          if (staleAlive) return true;
          throw new Error('ESRCH');
        }
        if (signal === 'SIGTERM' || signal === 'SIGKILL') {
          staleAlive = false;
          return true;
        }
        return true;
      }) as typeof process.kill);

    try {
      const manager = createRouterOpencodeManager({
        state,
        statePath,
        opencodeBinary: {
          bin: '/tmp/opencode',
          source: 'external',
          expectedVersion: undefined,
        },
        resolvedWorkdir: tempDir,
        opencodeHost: '127.0.0.1',
        opencodePort: 4096,
        opencodeUsername: 'opencode',
        opencodePassword: 'secret',
        authHeaders: undefined,
        corsOrigins: ['*'],
        logger: createLogger({
          format: 'pretty',
          runId: 'router-opencode-test',
          serviceName: 'pilot',
          output: 'silent',
        }),
        logVerbose: () => undefined,
        runId: 'router-opencode-test',
        logFormat: 'pretty',
        cliVersion: '0.0.1',
        sidecar: {
          dir: '/tmp',
          baseUrl: 'https://example.test',
          manifestUrl: 'https://example.test/pilot-host-sidecars.json',
          target: 'darwin-arm64',
        },
        sidecarSource: 'auto',
        opencodeSource: 'auto',
        allowExternal: true,
      });

      await manager.ensureOpencode();
      expect(killSpy).toHaveBeenCalledWith(456, 'SIGTERM');
      expect(servicesMock.startOpencode).toHaveBeenCalledTimes(1);
      expect(state.opencode?.pid).toBe(789);
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });
});
