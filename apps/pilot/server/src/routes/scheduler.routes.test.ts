/**
 * @license
 * Copyright 2026 cofy-x
 * SPDX-License-Identifier: Apache-2.0
 */

import { beforeEach, describe, expect, test, vi } from 'vitest';
import type { ServerConfig } from '../types/index.js';
import { workspaceIdForPath } from '../services/workspace.service.js';
import { registerSchedulerRoutes } from './scheduler.routes.js';
import type { Route } from '../http/router.js';
import { matchRoute } from '../http/router.js';
import { ApprovalService } from '../services/approval.service.js';
import { ReloadEventStore } from '../services/event-store.js';

const schedulerServiceMocks = vi.hoisted(() => ({
  listScheduledJobs: vi.fn(),
  resolveScheduledJobBySlug: vi.fn(),
  deleteResolvedScheduledJob: vi.fn(),
}));

const auditServiceMocks = vi.hoisted(() => ({
  recordAudit: vi.fn(),
  recordGlobalAudit: vi.fn(),
}));

vi.mock('../services/scheduler.service.js', () => schedulerServiceMocks);
vi.mock('../services/audit.service.js', () => auditServiceMocks);

function createServerConfig(): ServerConfig {
  const workspacePath = '/tmp/pilot-scheduler-workspace';
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

function createGlobalOnlyServerConfig(): ServerConfig {
  return {
    host: '127.0.0.1',
    port: 8787,
    maxBodyBytes: 1024 * 1024,
    token: 'client-token',
    hostToken: 'host-token',
    approval: { mode: 'auto', timeoutMs: 1000 },
    corsOrigins: ['*'],
    workspaces: [],
    authorizedRoots: [],
    readOnly: false,
    startedAt: Date.now(),
    tokenSource: 'generated',
    hostTokenSource: 'generated',
    logFormat: 'pretty',
    logRequests: false,
    warnings: [],
  };
}

describe('scheduler routes', () => {
  beforeEach(() => {
    schedulerServiceMocks.listScheduledJobs.mockReset();
    schedulerServiceMocks.resolveScheduledJobBySlug.mockReset();
    schedulerServiceMocks.deleteResolvedScheduledJob.mockReset();
    auditServiceMocks.recordAudit.mockReset();
    auditServiceMocks.recordGlobalAudit.mockReset();
    auditServiceMocks.recordGlobalAudit.mockResolvedValue(undefined);
  });

  test('registers global scheduler routes', () => {
    const routes: Route[] = [];
    registerSchedulerRoutes(routes, createServerConfig());

    expect(matchRoute(routes, 'GET', '/scheduler/jobs')?.auth).toBe('client');
    expect(matchRoute(routes, 'DELETE', '/scheduler/jobs/nightly')?.auth).toBe(
      'client',
    );
    expect(
      matchRoute(routes, 'GET', '/workspace/workspace-id/scheduler/jobs'),
    ).toBeNull();
    expect(
      matchRoute(routes, 'DELETE', '/workspace/workspace-id/scheduler/jobs/nightly'),
    ).toBeNull();
  });

  test('deletes scheduler job by exact slug on global route', async () => {
    const resolved = {
      job: {
        slug: 'nightly-build',
        name: 'Nightly Build',
        schedule: '0 3 * * *',
        createdAt: new Date().toISOString(),
      },
      jobFile: '/tmp/nightly-build.json',
      systemPaths: [],
    };
    schedulerServiceMocks.resolveScheduledJobBySlug.mockResolvedValue(resolved);
    schedulerServiceMocks.deleteResolvedScheduledJob.mockResolvedValue(undefined);

    const config = createServerConfig();
    const routes: Route[] = [];
    registerSchedulerRoutes(routes, config);
    const route = matchRoute(routes, 'DELETE', '/scheduler/jobs/nightly-build');
    if (!route) throw new Error('Missing global scheduler delete route');

    const response = await route.handler({
      request: new Request('http://localhost/scheduler/jobs/nightly-build', {
        method: 'DELETE',
      }),
      url: new URL('http://localhost/scheduler/jobs/nightly-build'),
      params: route.params,
      config,
      approvals: new ApprovalService(config.approval),
      reloadEvents: new ReloadEventStore(),
      actor: { type: 'remote', tokenHash: 'hash' },
    });
    const payload = (await response.json()) as {
      job?: { slug?: string };
    };

    expect(payload.job?.slug).toBe('nightly-build');
    expect(schedulerServiceMocks.resolveScheduledJobBySlug).toHaveBeenCalledTimes(1);
    expect(schedulerServiceMocks.deleteResolvedScheduledJob).toHaveBeenCalledWith(
      resolved,
    );
  });

  test('deletes scheduler job without requiring an active workspace', async () => {
    const resolved = {
      job: {
        slug: 'nightly-cleanup',
        name: 'Nightly Cleanup',
        schedule: '0 2 * * *',
        createdAt: new Date().toISOString(),
      },
      jobFile: '/tmp/nightly-cleanup.json',
      systemPaths: [],
    };
    schedulerServiceMocks.resolveScheduledJobBySlug.mockResolvedValue(resolved);
    schedulerServiceMocks.deleteResolvedScheduledJob.mockResolvedValue(undefined);

    const config = createGlobalOnlyServerConfig();
    const routes: Route[] = [];
    registerSchedulerRoutes(routes, config);
    const route = matchRoute(routes, 'DELETE', '/scheduler/jobs/nightly-cleanup');
    if (!route) throw new Error('Missing global scheduler delete route');

    const response = await route.handler({
      request: new Request('http://localhost/scheduler/jobs/nightly-cleanup', {
        method: 'DELETE',
      }),
      url: new URL('http://localhost/scheduler/jobs/nightly-cleanup'),
      params: route.params,
      config,
      approvals: new ApprovalService(config.approval),
      reloadEvents: new ReloadEventStore(),
      actor: { type: 'remote', tokenHash: 'hash' },
    });
    const payload = (await response.json()) as {
      job?: { slug?: string };
    };

    expect(payload.job?.slug).toBe('nightly-cleanup');
    expect(schedulerServiceMocks.resolveScheduledJobBySlug).toHaveBeenCalledTimes(1);
    expect(schedulerServiceMocks.deleteResolvedScheduledJob).toHaveBeenCalledWith(
      resolved,
    );
  });
});
