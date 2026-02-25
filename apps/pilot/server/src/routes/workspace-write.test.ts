/**
 * @license
 * Copyright 2026 cofy-x
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, expect, test } from 'vitest';
import { ApprovalService } from '../services/approval.service.js';
import { ReloadEventStore } from '../services/event-store.js';
import { workspaceIdForPath } from '../services/workspace.service.js';
import type { RequestContext } from '../http/router.js';
import type { ServerConfig } from '../types/index.js';
import { runWorkspaceWriteAction } from './workspace-write.js';

function createConfigWithAuditFailureWorkspace(): ServerConfig {
  const workspacePath = '/dev/null';
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
        name: 'null-workspace',
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

function createRequestContext(config: ServerConfig): RequestContext {
  const workspaceId = config.workspaces[0]?.id ?? '';
  return {
    request: new Request('http://localhost/workspace/write', {
      method: 'POST',
      headers: { 'x-request-id': 'req-1' },
    }),
    url: new URL('http://localhost/workspace/write'),
    params: { id: workspaceId },
    config,
    approvals: new ApprovalService(config.approval),
    reloadEvents: new ReloadEventStore(),
    actor: { type: 'remote', tokenHash: 'hash' },
  };
}

describe('runWorkspaceWriteAction', () => {
  test('returns write_partially_applied when mutate succeeds but audit fails', async () => {
    const config = createConfigWithAuditFailureWorkspace();
    const ctx = createRequestContext(config);

    await expect(
      runWorkspaceWriteAction({
        config,
        ctx,
        approval: () => ({
          action: 'config.patch',
          summary: 'Patch config',
          paths: ['/dev/null'],
        }),
        mutate: async () => ({ ok: true }),
        audit: () => ({
          action: 'config.patch',
          target: '/dev/null',
          summary: 'patched',
        }),
      }),
    ).rejects.toMatchObject({
      status: 500,
      code: 'write_partially_applied',
      details: expect.objectContaining({
        mutated: true,
        stage: 'audit',
      }),
    });
  });
});
