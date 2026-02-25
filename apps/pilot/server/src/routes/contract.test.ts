/**
 * @license
 * Copyright 2026 cofy-x
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, expect, test } from 'vitest';
import { createRoutes } from './index.js';
import { matchRoute } from '../http/router.js';
import { ApprovalService } from '../services/approval.service.js';
import { ReloadEventStore } from '../services/event-store.js';
import type { ServerConfig } from '../types/index.js';
import { workspaceIdForPath } from '../services/workspace.service.js';

function createServerConfig(): ServerConfig {
  const workspacePath = '/tmp/pilot-contract-workspace';
  return {
    host: '127.0.0.1',
    port: 8787,
    maxBodyBytes: 1024 * 1024,
    token: 'client-token',
    hostToken: 'host-token',
    approval: { mode: 'auto', timeoutMs: 1000 },
    corsOrigins: ['*'],
    workspaces: [
      {
        id: workspaceIdForPath(workspacePath),
        name: 'workspace',
        path: workspacePath,
        workspaceType: 'local',
        baseUrl: 'http://127.0.0.1:4096',
        directory: workspacePath,
        opencodeUsername: 'opencode',
        opencodePassword: 'secret',
      },
    ],
    authorizedRoots: [workspacePath],
    readOnly: false,
    startedAt: Date.now(),
    tokenSource: 'generated',
    hostTokenSource: 'generated',
    logFormat: 'pretty',
    logRequests: false,
    warnings: [],
  };
}

function createMultiWorkspaceConfig(): ServerConfig {
  const workspacePathA = '/tmp/pilot-contract-workspace-a';
  const workspacePathB = '/tmp/pilot-contract-workspace-b';
  return {
    host: '127.0.0.1',
    port: 8787,
    maxBodyBytes: 1024 * 1024,
    token: 'client-token',
    hostToken: 'host-token',
    approval: { mode: 'auto', timeoutMs: 1000 },
    corsOrigins: ['*'],
    workspaces: [
      {
        id: workspaceIdForPath(workspacePathB),
        name: 'workspace-b',
        path: workspacePathB,
        workspaceType: 'local',
        baseUrl: 'http://127.0.0.1:5001',
        directory: workspacePathB,
        opencodeUsername: 'user-b',
        opencodePassword: 'pass-b',
      },
      {
        id: workspaceIdForPath(workspacePathA),
        name: 'workspace-a',
        path: workspacePathA,
        workspaceType: 'local',
        baseUrl: 'http://127.0.0.1:5002',
        directory: workspacePathA,
        opencodeUsername: 'user-a',
        opencodePassword: 'pass-a',
      },
    ],
    authorizedRoots: [workspacePathA, workspacePathB],
    readOnly: false,
    startedAt: Date.now(),
    tokenSource: 'generated',
    hostTokenSource: 'generated',
    logFormat: 'pretty',
    logRequests: false,
    warnings: [],
  };
}

describe('route contract', () => {
  test('registers host/health/workspace contract routes', () => {
    const routes = createRoutes(createServerConfig());

    expect(matchRoute(routes, 'GET', '/health')?.auth).toBe('none');
    expect(matchRoute(routes, 'GET', '/workspaces')?.auth).toBe('client');
    expect(matchRoute(routes, 'GET', '/workspace/abc/config')?.auth).toBe('client');
    expect(matchRoute(routes, 'GET', '/approvals')?.auth).toBe('host');
  });

  test('returns expected payload shape for /health and /workspaces', async () => {
    const config = createServerConfig();
    const routes = createRoutes(config);
    const approvals = new ApprovalService(config.approval);
    const reloadEvents = new ReloadEventStore();

    const healthRoute = matchRoute(routes, 'GET', '/health');
    if (!healthRoute) throw new Error('Missing /health route');

    const healthResponse = await healthRoute.handler({
      request: new Request('http://localhost/health'),
      url: new URL('http://localhost/health'),
      params: healthRoute.params,
      config,
      approvals,
      reloadEvents,
    });
    const healthPayload = (await healthResponse.json()) as {
      ok?: boolean;
      version?: string;
      uptimeMs?: number;
    };

    expect(healthPayload.ok).toBe(true);
    expect(typeof healthPayload.version).toBe('string');
    expect(typeof healthPayload.uptimeMs).toBe('number');

    const workspacesRoute = matchRoute(routes, 'GET', '/workspaces');
    if (!workspacesRoute) throw new Error('Missing /workspaces route');

    const workspacesResponse = await workspacesRoute.handler({
      request: new Request('http://localhost/workspaces'),
      url: new URL('http://localhost/workspaces'),
      params: workspacesRoute.params,
      config,
      approvals,
      reloadEvents,
      actor: { type: 'remote', tokenHash: 'hash' },
    });
    const workspacesPayload = (await workspacesResponse.json()) as {
      items?: Array<{
        id?: string;
        opencode?: {
          baseUrl?: string;
          directory?: string;
          username?: string;
          password?: string;
        };
      }>;
      activeId?: string;
    };

    expect(workspacesPayload.items?.[0]?.id).toBe(config.workspaces[0]?.id);
    expect(workspacesPayload.activeId).toBe(config.workspaces[0]?.id);
    expect(workspacesPayload.items?.[0]?.opencode?.baseUrl).toBe(
      'http://127.0.0.1:4096',
    );
    expect(workspacesPayload.items?.[0]?.opencode?.directory).toBe(
      config.workspaces[0]?.path,
    );
    expect(workspacesPayload.items?.[0]?.opencode?.username).toBe('opencode');
    expect(workspacesPayload.items?.[0]?.opencode?.password).toBe('secret');
  });

  test('returns all authorized workspaces with active workspace first', async () => {
    const config = createMultiWorkspaceConfig();
    const routes = createRoutes(config);
    const approvals = new ApprovalService(config.approval);
    const reloadEvents = new ReloadEventStore();

    const workspacesRoute = matchRoute(routes, 'GET', '/workspaces');
    if (!workspacesRoute) throw new Error('Missing /workspaces route');
    const workspacesResponse = await workspacesRoute.handler({
      request: new Request('http://localhost/workspaces'),
      url: new URL('http://localhost/workspaces'),
      params: workspacesRoute.params,
      config,
      approvals,
      reloadEvents,
      actor: { type: 'remote', tokenHash: 'hash' },
    });
    const workspacesPayload = (await workspacesResponse.json()) as {
      items?: Array<{ id?: string }>;
      activeId?: string | null;
    };

    expect(workspacesPayload.items?.map((item) => item.id)).toEqual([
      config.workspaces[0]?.id,
      config.workspaces[1]?.id,
    ]);
    expect(workspacesPayload.activeId).toBe(config.workspaces[0]?.id);

    const statusRoute = matchRoute(routes, 'GET', '/status');
    if (!statusRoute) throw new Error('Missing /status route');
    const statusResponse = await statusRoute.handler({
      request: new Request('http://localhost/status'),
      url: new URL('http://localhost/status'),
      params: statusRoute.params,
      config,
      approvals,
      reloadEvents,
      actor: { type: 'remote', tokenHash: 'hash' },
    });
    const statusPayload = (await statusResponse.json()) as {
      workspaceCount?: number;
      activeWorkspaceId?: string | null;
      workspace?: {
        opencode?: {
          baseUrl?: string;
          directory?: string;
          username?: string;
          password?: string;
        };
      } | null;
    };
    expect(statusPayload.workspaceCount).toBe(2);
    expect(statusPayload.activeWorkspaceId).toBe(config.workspaces[0]?.id);
    expect(statusPayload.workspace?.opencode?.baseUrl).toBe('http://127.0.0.1:5001');
    expect(statusPayload.workspace?.opencode?.directory).toBe(
      config.workspaces[0]?.path,
    );
    expect(statusPayload.workspace?.opencode?.username).toBe('user-b');
    expect(statusPayload.workspace?.opencode?.password).toBe('pass-b');
  });
});
