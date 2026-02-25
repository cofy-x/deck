/**
 * @license
 * Copyright 2026 cofy-x
 * SPDX-License-Identifier: Apache-2.0
 */

import type { ServerConfig } from '../types/index.js';
import type { Route } from '../http/router.js';
import { addRoute } from '../http/router.js';
import {
  jsonResponse,
  readAndValidateJsonBody,
  searchParamsToRecord,
  validateWithSchema,
} from '../http/response.js';
import {
  resolveWorkspace,
  readOpencodeConfig,
  readPilotConfig,
  writePilotConfig,
  buildConfigTrigger,
  reloadOpencodeEngine,
  exportWorkspace,
  importWorkspace,
} from '../services/workspace.service.js';
import { readLastAudit, readAuditEntries } from '../services/audit.service.js';
import { opencodeConfigPath, pilotConfigPath } from '../utils/workspace-files.js';
import { updateJsoncTopLevel } from '../utils/jsonc.js';
import {
  auditQuerySchema,
  eventsQuerySchema,
  importConfigBodySchema,
  patchConfigBodySchema,
} from '../schemas/route.schema.js';
import { runWorkspaceWriteAction } from './workspace-write.js';

export function registerConfigRoutes(
  routes: Route[],
  config: ServerConfig,
): void {
  addRoute(routes, 'GET', '/workspace/:id/config', 'client', async (ctx) => {
    const workspace = await resolveWorkspace(config, ctx.params['id'] ?? '');
    const opencode = await readOpencodeConfig(workspace.path);
    const pilot = await readPilotConfig(workspace.path);
    const lastAudit = await readLastAudit(workspace.path);
    return jsonResponse({
      opencode,
      pilot,
      updatedAt: lastAudit?.timestamp ?? null,
    });
  });

  addRoute(routes, 'GET', '/workspace/:id/audit', 'client', async (ctx) => {
    const workspace = await resolveWorkspace(config, ctx.params['id'] ?? '');
    const query = validateWithSchema(
      auditQuerySchema,
      searchParamsToRecord(ctx.url.searchParams),
      'invalid_query',
      'Invalid audit query parameters',
    );
    const parsed = query.limit ? Number(query.limit) : NaN;
    const limit =
      Number.isFinite(parsed) && parsed > 0 ? Math.min(parsed, 200) : 50;
    const items = await readAuditEntries(workspace.path, limit);
    return jsonResponse({ items });
  });

  addRoute(routes, 'PATCH', '/workspace/:id/config', 'client', async (ctx) => {
    const body = await readAndValidateJsonBody(ctx.request, patchConfigBodySchema);
    await runWorkspaceWriteAction({
      config,
      ctx,
      approval: (workspace) => ({
        action: 'config.patch',
        summary: 'Patch workspace config',
        paths: [
          body.opencode ? opencodeConfigPath(workspace.path) : null,
          body.pilot ? pilotConfigPath(workspace.path) : null,
        ].filter((path): path is string => path !== null),
      }),
      mutate: async (workspace) => {
        if (body.opencode) {
          await updateJsoncTopLevel(opencodeConfigPath(workspace.path), body.opencode);
        }
        if (body.pilot) {
          await writePilotConfig(workspace.path, body.pilot, true);
        }
        return { opencodeUpdated: Boolean(body.opencode) };
      },
      audit: () => ({
        action: 'config.patch',
        target: 'opencode.json',
        summary: 'Patched workspace config',
      }),
      reload: (workspace, result) =>
        result.opencodeUpdated
          ? {
              reason: 'config',
              trigger: buildConfigTrigger(opencodeConfigPath(workspace.path)),
            }
          : null,
    });

    return jsonResponse({ updatedAt: Date.now() });
  });

  addRoute(routes, 'GET', '/workspace/:id/events', 'client', async (ctx) => {
    const workspace = await resolveWorkspace(config, ctx.params['id'] ?? '');
    const query = validateWithSchema(
      eventsQuerySchema,
      searchParamsToRecord(ctx.url.searchParams),
      'invalid_query',
      'Invalid events query parameters',
    );
    const parsedSince = query.since ? Number(query.since) : NaN;
    const since = Number.isFinite(parsedSince) ? parsedSince : undefined;
    const items = ctx.reloadEvents.list(workspace.id, since);
    return jsonResponse({ items, cursor: ctx.reloadEvents.cursor() });
  });

  addRoute(
    routes,
    'POST',
    '/workspace/:id/engine/reload',
    'client',
    async (ctx) => {
      await runWorkspaceWriteAction({
        config,
        ctx,
        requireWritable: false,
        approval: (workspace) => ({
          action: 'engine.reload',
          summary: 'Reload OpenCode engine',
          paths: [opencodeConfigPath(workspace.path)],
        }),
        mutate: async (workspace) => {
          await reloadOpencodeEngine(workspace);
          return { reloadedAt: Date.now() };
        },
        audit: () => ({
          action: 'engine.reload',
          target: 'opencode.instance',
          summary: 'Reloaded OpenCode engine',
        }),
      });
      return jsonResponse({ ok: true, reloadedAt: Date.now() });
    },
  );

  addRoute(routes, 'GET', '/workspace/:id/export', 'client', async (ctx) => {
    const workspace = await resolveWorkspace(config, ctx.params['id'] ?? '');
    const exportPayload = await exportWorkspace(workspace);
    return jsonResponse(exportPayload);
  });

  addRoute(routes, 'POST', '/workspace/:id/import', 'client', async (ctx) => {
    const body = await readAndValidateJsonBody(ctx.request, importConfigBodySchema);
    await runWorkspaceWriteAction({
      config,
      ctx,
      approval: (workspace) => ({
        action: 'config.import',
        summary: 'Import workspace config',
        paths: [opencodeConfigPath(workspace.path), pilotConfigPath(workspace.path)],
      }),
      mutate: async (workspace) => {
        await importWorkspace(workspace, body);
        return { ok: true };
      },
      audit: () => ({
        action: 'config.import',
        target: 'workspace',
        summary: 'Imported workspace config',
      }),
      reload: (workspace) => ({
        reason: 'config',
        trigger: buildConfigTrigger(opencodeConfigPath(workspace.path)),
      }),
    });
    return jsonResponse({ ok: true });
  });
}
