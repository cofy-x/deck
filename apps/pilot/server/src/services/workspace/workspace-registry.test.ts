/**
 * @license
 * Copyright 2026 cofy-x
 * SPDX-License-Identifier: Apache-2.0
 */

import { mkdtemp, mkdir, realpath, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, test } from 'vitest';
import type { ServerConfig } from '../../types/index.js';
import type { ApiError } from '../../errors.js';
import { workspaceIdForPath } from './workspace-identity.js';
import { resolveActiveWorkspace, resolveWorkspace } from './workspace-registry.js';

function buildServerConfig(overrides: Partial<ServerConfig>): ServerConfig {
  return {
    host: '127.0.0.1',
    port: 8787,
    maxBodyBytes: 1024 * 1024,
    token: 'token',
    hostToken: 'host-token',
    approval: { mode: 'manual', timeoutMs: 1000 },
    corsOrigins: ['*'],
    workspaces: [],
    authorizedRoots: [],
    readOnly: false,
    startedAt: Date.now(),
    tokenSource: 'generated',
    hostTokenSource: 'generated',
    logFormat: 'pretty',
    logRequests: true,
    warnings: [],
    ...overrides,
  };
}

describe('workspace registry', () => {
  test('resolves workspace through symlink and authorizes by realpath root', async () => {
    const base = await mkdtemp(join(tmpdir(), 'pilot-server-workspace-test-'));
    const root = join(base, 'root');
    const workspace = join(root, 'workspace');
    const symlinkPath = join(base, 'workspace-link');

    await mkdir(workspace, { recursive: true });
    await symlink(workspace, symlinkPath, 'dir');

    const workspaceId = workspaceIdForPath(symlinkPath);
    const config = buildServerConfig({
      workspaces: [
        {
          id: workspaceId,
          name: 'workspace',
          path: symlinkPath,
          workspaceType: 'local',
        },
      ],
      authorizedRoots: [root],
    });

    const resolved = await resolveWorkspace(config, workspaceId);
    expect(resolved.path).toBe(await realpath(workspace));
  });

  test('rejects workspace outside authorized roots', async () => {
    const base = await mkdtemp(join(tmpdir(), 'pilot-server-workspace-test-'));
    const root = join(base, 'root');
    const workspace = join(base, 'workspace');

    await mkdir(root, { recursive: true });
    await mkdir(workspace, { recursive: true });

    const workspaceId = workspaceIdForPath(workspace);
    const config = buildServerConfig({
      workspaces: [
        {
          id: workspaceId,
          name: 'workspace',
          path: workspace,
          workspaceType: 'local',
        },
      ],
      authorizedRoots: [root],
    });

    await expect(resolveWorkspace(config, workspaceId)).rejects.toMatchObject({
      status: 403,
      code: 'workspace_unauthorized',
    } satisfies Partial<ApiError>);
  });

  test('throws no_active_workspace when active workspace is missing', async () => {
    const config = buildServerConfig({
      workspaces: [],
      authorizedRoots: [],
    });

    await expect(resolveActiveWorkspace(config)).rejects.toMatchObject({
      status: 409,
      code: 'no_active_workspace',
    } satisfies Partial<ApiError>);
  });
});
