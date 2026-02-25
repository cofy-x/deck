/**
 * @license
 * Copyright 2026 cofy-x
 * SPDX-License-Identifier: Apache-2.0
 */

import type { ServerConfig } from '../types/index.js';
import type { Route } from '../http/router.js';
import { addRoute } from '../http/router.js';
import { jsonResponse } from '../http/response.js';
import { SERVER_VERSION } from '../http/logger.js';
import {
  listAuthorizedWorkspaces,
  resolveWorkspace,
  serializeWorkspace,
  buildCapabilities,
} from '../services/workspace.service.js';
import { recordAudit } from '../services/audit.service.js';
import { shortId } from '../utils/crypto.js';

export function registerHealthRoutes(
  routes: Route[],
  config: ServerConfig,
): void {
  addRoute(routes, 'GET', '/health', 'none', async () =>
    jsonResponse({
      ok: true,
      version: SERVER_VERSION,
      uptimeMs: Date.now() - config.startedAt,
    }),
  );

  addRoute(routes, 'GET', '/w/:id/health', 'none', async () =>
    jsonResponse({
      ok: true,
      version: SERVER_VERSION,
      uptimeMs: Date.now() - config.startedAt,
    }),
  );

  addRoute(routes, 'GET', '/w/:id/status', 'client', async (ctx) => {
    const workspace = await resolveWorkspace(config, ctx.params['id'] ?? '');
    return jsonResponse({
      ok: true,
      version: SERVER_VERSION,
      uptimeMs: Date.now() - config.startedAt,
      readOnly: config.readOnly,
      approval: config.approval,
      corsOrigins: config.corsOrigins,
      workspaceCount: 1,
      activeWorkspaceId: workspace.id,
      workspace: serializeWorkspace(workspace),
      authorizedRoots: config.authorizedRoots,
      server: {
        host: config.host,
        port: config.port,
        configPath: config.configPath ?? null,
      },
      tokenSource: { client: config.tokenSource, host: config.hostTokenSource },
    });
  });

  addRoute(routes, 'GET', '/w/:id/capabilities', 'client', async () =>
    jsonResponse(buildCapabilities(config)),
  );

  addRoute(routes, 'GET', '/w/:id/workspaces', 'client', async (ctx) => {
    const workspace = await resolveWorkspace(config, ctx.params['id'] ?? '');
    return jsonResponse({
      items: [serializeWorkspace(workspace)],
      activeId: workspace.id,
    });
  });

  addRoute(routes, 'GET', '/status', 'client', async () => {
    const authorized = await listAuthorizedWorkspaces(config);
    const activeCandidateId = config.workspaces[0]?.id;
    const active = activeCandidateId
      ? authorized.find((workspace) => workspace.id === activeCandidateId) ?? null
      : null;
    return jsonResponse({
      ok: true,
      version: SERVER_VERSION,
      uptimeMs: Date.now() - config.startedAt,
      readOnly: config.readOnly,
      approval: config.approval,
      corsOrigins: config.corsOrigins,
      workspaceCount: authorized.length,
      activeWorkspaceId: active?.id ?? null,
      workspace: active ? serializeWorkspace(active) : null,
      authorizedRoots: config.authorizedRoots,
      server: {
        host: config.host,
        port: config.port,
        configPath: config.configPath ?? null,
      },
      tokenSource: { client: config.tokenSource, host: config.hostTokenSource },
    });
  });

  addRoute(routes, 'GET', '/capabilities', 'client', async () =>
    jsonResponse(buildCapabilities(config)),
  );

  addRoute(routes, 'GET', '/workspaces', 'client', async () => {
    const authorized = await listAuthorizedWorkspaces(config);
    const activeCandidateId = config.workspaces[0]?.id;
    const active = activeCandidateId
      ? authorized.find((workspace) => workspace.id === activeCandidateId) ?? null
      : null;
    const ordered = active
      ? [
          active,
          ...authorized.filter((workspace) => workspace.id !== active.id),
        ]
      : authorized;
    const items = ordered.map((workspace) => serializeWorkspace(workspace));
    return jsonResponse({
      items,
      activeId: active?.id ?? null,
    });
  });

  addRoute(routes, 'POST', '/workspaces/:id/activate', 'host', async (ctx) => {
    const workspace = await resolveWorkspace(config, ctx.params['id'] ?? '');
    config.workspaces = [
      workspace,
      ...config.workspaces.filter((entry) => entry.id !== workspace.id),
    ];
    await recordAudit(workspace.path, {
      id: shortId(),
      workspaceId: workspace.id,
      actor: ctx.actor ?? { type: 'host' },
      action: 'workspace.activate',
      target: 'workspace',
      summary: 'Switched active workspace',
      timestamp: Date.now(),
    });
    return jsonResponse({
      activeId: workspace.id,
      workspace: serializeWorkspace(workspace),
    });
  });
}
