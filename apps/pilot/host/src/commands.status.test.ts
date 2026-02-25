/**
 * @license
 * Copyright 2026 cofy-x
 * SPDX-License-Identifier: Apache-2.0
 */

import { afterEach, describe, expect, test, vi } from 'vitest';

import { parseArgs } from './args.js';
import { runStatus } from './commands.js';

type StatusOutput = {
  bridge?: {
    ok: boolean;
    url: string;
    error?: string;
    health?: {
      channels: Record<string, boolean>;
    };
  };
};

interface CapturedStatusResult {
  output: StatusOutput;
  exitCode: number;
}

interface CapturedStatusTextResult {
  stdout: string;
  exitCode: number;
}

function mockFetchOnce(response: Response): void {
  const fetchMock = vi.fn<
    (...args: Parameters<typeof fetch>) => ReturnType<typeof fetch>
  >();
  fetchMock.mockResolvedValueOnce(response);
  vi.stubGlobal('fetch', fetchMock);
}

async function captureStatusJson(argv: string[]): Promise<CapturedStatusResult> {
  let stdout = '';
  const writeSpy = vi
    .spyOn(process.stdout, 'write')
    .mockImplementation((chunk: string | Uint8Array): boolean => {
      stdout +=
        typeof chunk === 'string'
          ? chunk
          : Buffer.from(chunk).toString('utf8');
      return true;
    });

  try {
    const exitCode = await runStatus(parseArgs(argv));
    const parsed = JSON.parse(stdout.trim()) as StatusOutput;
    return { output: parsed, exitCode };
  } finally {
    writeSpy.mockRestore();
  }
}

async function captureStatusText(
  argv: string[],
): Promise<CapturedStatusTextResult> {
  let stdout = '';
  const writeSpy = vi
    .spyOn(process.stdout, 'write')
    .mockImplementation((chunk: string | Uint8Array): boolean => {
      stdout +=
        typeof chunk === 'string'
          ? chunk
          : Buffer.from(chunk).toString('utf8');
      return true;
    });

  try {
    const exitCode = await runStatus(parseArgs(argv));
    return { stdout, exitCode };
  } finally {
    writeSpy.mockRestore();
  }
}

describe('runStatus bridge health', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    delete process.env['PILOT_BRIDGE_URL'];
    delete process.env['BRIDGE_HEALTH_PORT'];
  });

  test('returns bridge health with 9 channels in json mode', async () => {
    mockFetchOnce(
      new Response(
        JSON.stringify({
          ok: true,
          opencode: { url: 'http://127.0.0.1:4096', healthy: true },
          channels: {
            telegram: true,
            whatsapp: false,
            slack: true,
            feishu: true,
            discord: true,
            dingtalk: false,
            email: true,
            mochat: false,
            qq: true,
          },
          config: { groupsEnabled: true },
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    );

    const { output, exitCode } = await captureStatusJson([
      'status',
      '--bridge-url',
      'http://127.0.0.1:3005',
      '--json',
    ]);

    expect(output.bridge?.ok).toBe(true);
    expect(output.bridge?.health?.channels['telegram']).toBe(true);
    expect(output.bridge?.health?.channels['qq']).toBe(true);
    expect(Object.keys(output.bridge?.health?.channels ?? {})).toHaveLength(9);
    expect(exitCode).toBe(0);
  });

  test('returns bridge error when bridge health request fails', async () => {
    mockFetchOnce(
      new Response(JSON.stringify({ message: 'bridge down' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    const { output, exitCode } = await captureStatusJson([
      'status',
      '--bridge-url',
      'http://127.0.0.1:3005',
      '--json',
    ]);

    expect(output.bridge?.ok).toBe(false);
    expect(output.bridge?.error).toContain('HTTP 500');
    expect(exitCode).toBe(1);
  });

  test('uses default local bridge url when bridge url is not provided', async () => {
    mockFetchOnce(
      new Response(
        JSON.stringify({
          ok: true,
          opencode: { url: 'http://127.0.0.1:4096', healthy: true },
          channels: {
            telegram: false,
            whatsapp: false,
            slack: false,
          },
          config: { groupsEnabled: true },
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    );

    const { output, exitCode } = await captureStatusJson(['status', '--json']);
    expect(output.bridge?.ok).toBe(true);
    expect(output.bridge?.url).toBe('http://127.0.0.1:3005');
    expect(exitCode).toBe(0);
  });

  test('prints grouped bridge channels in text mode', async () => {
    mockFetchOnce(
      new Response(
        JSON.stringify({
          ok: true,
          opencode: { url: 'http://127.0.0.1:4096', healthy: true },
          channels: {
            telegram: true,
            whatsapp: false,
            slack: true,
            feishu: false,
            discord: true,
            dingtalk: false,
            email: true,
            mochat: false,
            qq: false,
          },
          config: { groupsEnabled: true },
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    );

    const { stdout, exitCode } = await captureStatusText([
      'status',
      '--bridge-url',
      'http://127.0.0.1:3005',
    ]);

    expect(stdout).toContain('Bridge: ok (http://127.0.0.1:3005)');
    expect(stdout).toContain('  Bridge channels:');
    expect(stdout).toContain('enabled (4): telegram, slack, discord, email');
    expect(stdout).toContain(
      'disabled (5): whatsapp, feishu, dingtalk, mochat, qq',
    );
    expect(stdout).toContain('Summary: 1/1 services healthy');
    expect(exitCode).toBe(0);
  });
});
