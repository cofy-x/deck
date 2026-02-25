/**
 * @license
 * Copyright 2026 cofy-x
 * SPDX-License-Identifier: Apache-2.0
 */

import { mkdtemp, writeFile, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { afterEach, describe, expect, test } from 'vitest';
import type { CliArgs } from './types/index.js';
import { resolveServerConfig } from './config.js';

const ENV_KEYS = [
  'PILOT_SERVER_CONFIG',
  'PILOT_HOST',
  'PILOT_PORT',
  'PILOT_TOKEN',
  'PILOT_HOST_TOKEN',
  'PILOT_APPROVAL_MODE',
  'PILOT_APPROVAL_TIMEOUT_MS',
  'PILOT_MAX_BODY_BYTES',
  'PILOT_WORKSPACE',
  'PILOT_WORKSPACES',
  'PILOT_OPENCODE_URL',
  'PILOT_OPENCODE_DIRECTORY',
];

const ENV_SNAPSHOT = new Map<string, string | undefined>(
  ENV_KEYS.map((key) => [key, process.env[key]]),
);

function restoreEnv(): void {
  for (const key of ENV_KEYS) {
    const value = ENV_SNAPSHOT.get(key);
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }
}

afterEach(() => {
  restoreEnv();
});

async function createConfigFixture(content: object): Promise<{
  configPath: string;
  workspacePath: string;
}> {
  const dir = await mkdtemp(join(tmpdir(), 'pilot-server-config-test-'));
  const workspacePath = join(dir, 'workspace');
  await mkdir(workspacePath, { recursive: true });
  const configPath = join(dir, 'server.json');
  await writeFile(configPath, JSON.stringify(content, null, 2), 'utf8');
  return { configPath, workspacePath };
}

function createCliArgs(overrides: Partial<CliArgs> = {}): CliArgs {
  return {
    workspaces: [],
    ...overrides,
  };
}

describe('resolveServerConfig', () => {
  test('applies config precedence: cli > env > file', async () => {
    const fixture = await createConfigFixture({
      host: 'file-host',
      port: 1111,
      token: 'file-token',
      hostToken: 'file-host-token',
      approval: { mode: 'manual', timeoutMs: 3333 },
      workspaces: [{ path: './workspace' }],
      maxBodyBytes: 12345,
    });

    process.env['PILOT_HOST'] = 'env-host';
    process.env['PILOT_PORT'] = '2222';
    process.env['PILOT_TOKEN'] = 'env-token';
    process.env['PILOT_HOST_TOKEN'] = 'env-host-token';

    const config = await resolveServerConfig(
      createCliArgs({
        configPath: fixture.configPath,
        host: 'cli-host',
        port: 3333,
        token: 'cli-token',
      }),
    );

    expect(config.host).toBe('cli-host');
    expect(config.port).toBe(3333);
    expect(config.token).toBe('cli-token');
    expect(config.hostToken).toBe('env-host-token');
  });

  test('reads max body bytes from env', async () => {
    const fixture = await createConfigFixture({
      workspaces: [{ path: './workspace' }],
    });

    process.env['PILOT_MAX_BODY_BYTES'] = '2048';

    const config = await resolveServerConfig(
      createCliArgs({ configPath: fixture.configPath }),
    );

    expect(config.maxBodyBytes).toBe(2048);
  });

  test('reads opencode url from PILOT_OPENCODE_URL', async () => {
    const fixture = await createConfigFixture({
      workspaces: [{ path: './workspace' }],
    });

    process.env['PILOT_OPENCODE_URL'] = 'http://127.0.0.1:4096';

    const config = await resolveServerConfig(
      createCliArgs({ configPath: fixture.configPath }),
    );

    expect(config.workspaces[0]?.baseUrl).toBe('http://127.0.0.1:4096');
  });

  test('supports PILOT_WORKSPACE as workspace fallback', async () => {
    const fixture = await createConfigFixture({});

    process.env['PILOT_WORKSPACE'] = fixture.workspacePath;

    const config = await resolveServerConfig(
      createCliArgs({ configPath: fixture.configPath }),
    );

    expect(config.workspaces).toHaveLength(1);
    expect(config.workspaces[0]?.path).toBe(fixture.workspacePath);
  });

  test('prefers PILOT_WORKSPACES over PILOT_WORKSPACE', async () => {
    const fixture = await createConfigFixture({});
    const workspaceAlt = join(dirname(fixture.workspacePath), 'workspace-alt');
    await mkdir(workspaceAlt, { recursive: true });

    process.env['PILOT_WORKSPACE'] = fixture.workspacePath;
    process.env['PILOT_WORKSPACES'] = workspaceAlt;

    const config = await resolveServerConfig(
      createCliArgs({ configPath: fixture.configPath }),
    );

    expect(config.workspaces).toHaveLength(1);
    expect(config.workspaces[0]?.path).toBe(workspaceAlt);
  });

  test('falls back when env approval mode is invalid', async () => {
    const fixture = await createConfigFixture({
      approval: { mode: 'auto', timeoutMs: 1111 },
      workspaces: [{ path: './workspace' }],
    });

    process.env['PILOT_APPROVAL_MODE'] = 'invalid';

    const config = await resolveServerConfig(
      createCliArgs({ configPath: fixture.configPath }),
    );

    expect(config.approval.mode).toBe('auto');
    expect(config.approval.timeoutMs).toBe(1111);
    expect(config.warnings.some((item) => item.includes('PILOT_APPROVAL_MODE'))).toBe(true);
  });

  test('records warnings for invalid numeric env values and falls back', async () => {
    const fixture = await createConfigFixture({
      port: 9888,
      approval: { mode: 'manual', timeoutMs: 2222 },
      maxBodyBytes: 4096,
      workspaces: [{ path: './workspace' }],
    });

    process.env['PILOT_PORT'] = 'abc';
    process.env['PILOT_APPROVAL_TIMEOUT_MS'] = '-1';
    process.env['PILOT_MAX_BODY_BYTES'] = '1.5';

    const config = await resolveServerConfig(
      createCliArgs({ configPath: fixture.configPath }),
    );

    expect(config.port).toBe(9888);
    expect(config.approval.timeoutMs).toBe(2222);
    expect(config.maxBodyBytes).toBe(4096);
    expect(config.warnings).toEqual(
      expect.arrayContaining([
        expect.stringContaining('PILOT_PORT'),
        expect.stringContaining('PILOT_APPROVAL_TIMEOUT_MS'),
        expect.stringContaining('PILOT_MAX_BODY_BYTES'),
      ]),
    );
  });

  test('throws invalid_config when config file contains invalid JSON', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'pilot-server-config-test-'));
    const configPath = join(dir, 'server.json');
    await writeFile(configPath, '{"host": "127.0.0.1"', 'utf8');

    await expect(
      resolveServerConfig(createCliArgs({ configPath })),
    ).rejects.toMatchObject({
      status: 422,
      code: 'invalid_config',
    });
  });

  test('throws invalid_workspace_config when remote workspace is missing required fields', async () => {
    const fixture = await createConfigFixture({
      workspaces: [
        {
          path: './workspace',
          workspaceType: 'remote',
          baseUrl: 'http://127.0.0.1:4096',
        },
      ],
    });

    await expect(
      resolveServerConfig(createCliArgs({ configPath: fixture.configPath })),
    ).rejects.toMatchObject({
      status: 422,
      code: 'invalid_workspace_config',
    });
  });

  test('throws duplicate_workspace_id when configured ids conflict', async () => {
    const fixture = await createConfigFixture({
      workspaces: [
        { id: 'workspace-id', path: './workspace' },
        { id: 'workspace-id', path: './workspace-2' },
      ],
    });
    await mkdir(join(dirname(fixture.configPath), 'workspace-2'), {
      recursive: true,
    });

    await expect(
      resolveServerConfig(createCliArgs({ configPath: fixture.configPath })),
    ).rejects.toMatchObject({
      status: 422,
      code: 'duplicate_workspace_id',
    });
  });

  test('generates distinct workspace ids for same path with different baseUrl', async () => {
    const fixture = await createConfigFixture({
      workspaces: [
        {
          path: './workspace',
          workspaceType: 'local',
          baseUrl: 'http://127.0.0.1:4096',
        },
        {
          path: './workspace',
          workspaceType: 'local',
          baseUrl: 'http://127.0.0.1:4097',
        },
      ],
    });

    const config = await resolveServerConfig(
      createCliArgs({ configPath: fixture.configPath }),
    );

    expect(config.workspaces).toHaveLength(2);
    expect(config.workspaces[0]?.id).not.toBe(config.workspaces[1]?.id);
  });
});
