/**
 * @license
 * Copyright 2026 cofy-x
 * SPDX-License-Identifier: Apache-2.0
 */

import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import { afterEach, describe, expect, test, vi } from 'vitest';

vi.mock('./utils/network.js', async () => {
  const actual = await vi.importActual<typeof import('./utils/network.js')>(
    './utils/network.js',
  );
  return {
    ...actual,
    resolvePort: vi.fn(
      async (
        preferred: number | undefined,
        _host: string,
        fallback?: number,
      ): Promise<number> => preferred ?? fallback ?? 45_000,
    ),
  };
});

import { parseArgs } from './args.js';
import { resolveStartConfig } from './start/config.js';

const createdDirs: string[] = [];

async function createTempWorkspace(): Promise<string> {
  const path = await mkdtemp(join(tmpdir(), 'pilot-host-start-test-'));
  createdDirs.push(path);
  return path;
}

describe('start config', () => {
  afterEach(async () => {
    delete process.env['PILOT_OPENCODE_URL'];
    delete process.env['PILOT_URL'];
    delete process.env['PILOT_BRIDGE_URL'];
    delete process.env['PILOT_TOKEN'];
    delete process.env['PILOT_HOST_TOKEN'];
    await Promise.all(
      createdDirs.splice(0).map((path) =>
        rm(path, { recursive: true, force: true }),
      ),
    );
  });

  test('uses connect-host only for connect urls and keeps local base urls', async () => {
    const workspace = await createTempWorkspace();
    const args = parseArgs([
      'start',
      '--workspace',
      workspace,
      '--connect-host',
      '192.168.0.10',
      '--json',
    ]);

    const config = await resolveStartConfig(args);
    const opencodeBaseUrl = new URL(config.opencodeBaseUrl);
    const opencodeConnectUrl = new URL(config.opencodeConnectUrl);
    const pilotBaseUrl = new URL(config.pilotBaseUrl);
    const pilotConnectUrl = new URL(config.pilotConnectUrl);

    expect(config.logger.output).toBe('silent');
    expect(opencodeBaseUrl.hostname).toBe('127.0.0.1');
    expect(opencodeConnectUrl.hostname).toBe('192.168.0.10');
    expect(opencodeBaseUrl.port).toBe(opencodeConnectUrl.port);
    expect(pilotBaseUrl.hostname).toBe('127.0.0.1');
    expect(pilotConnectUrl.hostname).toBe('192.168.0.10');
    expect(pilotBaseUrl.port).toBe(pilotConnectUrl.port);
  });

  test('uses external OpenCode URL and disables host-managed OpenCode mode', async () => {
    const workspace = await createTempWorkspace();
    const args = parseArgs([
      'start',
      '--workspace',
      workspace,
      '--opencode-url',
      'http://127.0.0.1:4096/',
    ]);

    const config = await resolveStartConfig(args);

    expect(config.opencodeManagedByHost).toBe(false);
    expect(config.opencodeBaseUrl).toBe('http://127.0.0.1:4096');
    expect(config.opencodeConnectUrl).toBe('http://127.0.0.1:4096');
    expect(config.opencodeBindHost).toBe('127.0.0.1');
    expect(config.opencodePort).toBe(4096);
  });

  test('throws when opencode-url is combined with opencode-host', async () => {
    const workspace = await createTempWorkspace();
    const args = parseArgs([
      'start',
      '--workspace',
      workspace,
      '--opencode-url',
      'http://127.0.0.1:4096',
      '--opencode-host',
      '0.0.0.0',
    ]);

    await expect(resolveStartConfig(args)).rejects.toThrow(
      '--opencode-url cannot be used with --opencode-host or --opencode-port.',
    );
  });

  test('throws when opencode-url is combined with opencode-port', async () => {
    const workspace = await createTempWorkspace();
    const args = parseArgs([
      'start',
      '--workspace',
      workspace,
      '--opencode-url',
      'http://127.0.0.1:4096',
      '--opencode-port',
      '4097',
    ]);

    await expect(resolveStartConfig(args)).rejects.toThrow(
      '--opencode-url cannot be used with --opencode-host or --opencode-port.',
    );
  });

  test('uses external OpenCode URL from environment', async () => {
    const workspace = await createTempWorkspace();
    process.env['PILOT_OPENCODE_URL'] = 'http://127.0.0.1:4200';
    const args = parseArgs(['start', '--workspace', workspace]);

    const config = await resolveStartConfig(args);

    expect(config.opencodeManagedByHost).toBe(false);
    expect(config.opencodeBaseUrl).toBe('http://127.0.0.1:4200');
    expect(config.opencodePort).toBe(4200);
  });

  test('uses external pilot URL and disables host-managed pilot mode', async () => {
    const workspace = await createTempWorkspace();
    const args = parseArgs([
      'start',
      '--workspace',
      workspace,
      '--pilot-url',
      'http://127.0.0.1:8787/',
      '--pilot-token',
      'pilot-token',
      '--pilot-host-token',
      'pilot-host-token',
    ]);

    const config = await resolveStartConfig(args);

    expect(config.pilotManagedByHost).toBe(false);
    expect(config.pilotBaseUrl).toBe('http://127.0.0.1:8787');
    expect(config.pilotConnectUrl).toBe('http://127.0.0.1:8787');
    expect(config.pilotHost).toBe('127.0.0.1');
    expect(config.pilotPort).toBe(8787);
  });

  test('uses external pilot URL from environment', async () => {
    const workspace = await createTempWorkspace();
    process.env['PILOT_URL'] = 'http://127.0.0.1:9787';
    process.env['PILOT_TOKEN'] = 'pilot-token';
    process.env['PILOT_HOST_TOKEN'] = 'pilot-host-token';
    const args = parseArgs(['start', '--workspace', workspace]);

    const config = await resolveStartConfig(args);

    expect(config.pilotManagedByHost).toBe(false);
    expect(config.pilotBaseUrl).toBe('http://127.0.0.1:9787');
    expect(config.pilotPort).toBe(9787);
  });

  test('throws when pilot-url is combined with pilot-host', async () => {
    const workspace = await createTempWorkspace();
    const args = parseArgs([
      'start',
      '--workspace',
      workspace,
      '--pilot-url',
      'http://127.0.0.1:8787',
      '--pilot-token',
      'pilot-token',
      '--pilot-host-token',
      'pilot-host-token',
      '--pilot-host',
      '0.0.0.0',
    ]);

    await expect(resolveStartConfig(args)).rejects.toThrow(
      '--pilot-url cannot be used with --pilot-host, --pilot-port, or --pilot-server-bin.',
    );
  });

  test('throws when pilot-url is combined with pilot-server-bin', async () => {
    const workspace = await createTempWorkspace();
    const args = parseArgs([
      'start',
      '--workspace',
      workspace,
      '--pilot-url',
      'http://127.0.0.1:8787',
      '--pilot-token',
      'pilot-token',
      '--pilot-host-token',
      'pilot-host-token',
      '--pilot-server-bin',
      '/tmp/pilot-server',
    ]);

    await expect(resolveStartConfig(args)).rejects.toThrow(
      '--pilot-url cannot be used with --pilot-host, --pilot-port, or --pilot-server-bin.',
    );
  });

  test('throws when pilot-url is missing required tokens', async () => {
    const workspace = await createTempWorkspace();
    const args = parseArgs([
      'start',
      '--workspace',
      workspace,
      '--pilot-url',
      'http://127.0.0.1:8787',
    ]);

    await expect(resolveStartConfig(args)).rejects.toThrow(
      'External --pilot-url requires --pilot-token and --pilot-host-token (or PILOT_TOKEN and PILOT_HOST_TOKEN).',
    );
  });

  test('uses external bridge URL and disables host-managed bridge mode', async () => {
    const workspace = await createTempWorkspace();
    const args = parseArgs([
      'start',
      '--workspace',
      workspace,
      '--bridge-url',
      'http://127.0.0.1:3005/',
    ]);

    const config = await resolveStartConfig(args);

    expect(config.bridgeEnabled).toBe(true);
    expect(config.bridgeManagedByHost).toBe(false);
    expect(config.bridgeHealthUrl).toBe('http://127.0.0.1:3005');
    expect(config.bridgeHealthPort).toBe(3005);
  });

  test('throws when bridge-url is combined with no-bridge', async () => {
    const workspace = await createTempWorkspace();
    const args = parseArgs([
      'start',
      '--workspace',
      workspace,
      '--bridge-url',
      'http://127.0.0.1:3005',
      '--no-bridge',
    ]);

    await expect(resolveStartConfig(args)).rejects.toThrow(
      '--bridge-url cannot be used with --no-bridge.',
    );
  });

  test('throws when bridge-url is combined with bridge-health-port', async () => {
    const workspace = await createTempWorkspace();
    const args = parseArgs([
      'start',
      '--workspace',
      workspace,
      '--bridge-url',
      'http://127.0.0.1:3005',
      '--bridge-health-port',
      '3006',
    ]);

    await expect(resolveStartConfig(args)).rejects.toThrow(
      '--bridge-url cannot be used with --bridge-bin or --bridge-health-port.',
    );
  });
});
