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
import { requireHost } from '../http/auth.js';
import { resolveWorkspace } from '../services/workspace.service.js';
import {
  addPlugin,
  listPlugins,
  normalizePluginSpec,
  removePlugin,
} from '../services/plugin.service.js';
import { opencodeConfigPath } from '../utils/workspace-files.js';
import {
  addPluginBodySchema,
  includeGlobalQuerySchema,
} from '../schemas/route.schema.js';
import { runWorkspaceWriteAction } from './workspace-write.js';

export function registerPluginRoutes(
  routes: Route[],
  config: ServerConfig,
): void {
  addRoute(routes, 'GET', '/workspace/:id/plugins', 'client', async (ctx) => {
    const workspace = await resolveWorkspace(config, ctx.params['id'] ?? '');
    const query = validateWithSchema(
      includeGlobalQuerySchema,
      searchParamsToRecord(ctx.url.searchParams),
      'invalid_query',
      'Invalid plugin query parameters',
    );
    const includeGlobal = query.includeGlobal === 'true';
    if (includeGlobal) {
      requireHost(ctx.request, config);
    }
    const result = await listPlugins(workspace.path, includeGlobal);
    return jsonResponse(result);
  });

  addRoute(routes, 'POST', '/workspace/:id/plugins', 'client', async (ctx) => {
    const body = await readAndValidateJsonBody(ctx.request, addPluginBodySchema);
    const spec = body.spec;
    const normalized = normalizePluginSpec(spec);
    const payload = await runWorkspaceWriteAction({
      config,
      ctx,
      approval: (workspace) => ({
        action: 'plugins.add',
        summary: `Add plugin ${spec}`,
        paths: [opencodeConfigPath(workspace.path)],
      }),
      mutate: async (workspace) => {
        const changed = await addPlugin(workspace.path, spec);
        const result = await listPlugins(workspace.path, false);
        return { changed, result };
      },
      audit: () => ({
        action: 'plugins.add',
        target: 'opencode.json',
        summary: `Added ${spec}`,
      }),
      reload: (_, result) =>
        result.changed
          ? {
              reason: 'plugins',
              trigger: { type: 'plugin', name: normalized, action: 'added' },
            }
          : null,
    });
    return jsonResponse(payload.result);
  });

  addRoute(
    routes,
    'DELETE',
    '/workspace/:id/plugins/:name',
    'client',
    async (ctx) => {
      const name = ctx.params['name'] ?? '';
      const normalized = normalizePluginSpec(name);
      const payload = await runWorkspaceWriteAction({
        config,
        ctx,
        approval: (workspace) => ({
          action: 'plugins.remove',
          summary: `Remove plugin ${name}`,
          paths: [opencodeConfigPath(workspace.path)],
        }),
        mutate: async (workspace) => {
          const removed = await removePlugin(workspace.path, name);
          const result = await listPlugins(workspace.path, false);
          return { removed, result };
        },
        audit: () => ({
          action: 'plugins.remove',
          target: 'opencode.json',
          summary: `Removed ${name}`,
        }),
        reload: (_, result) =>
          result.removed
            ? {
                reason: 'plugins',
                trigger: {
                  type: 'plugin',
                  name: normalized,
                  action: 'removed',
                },
              }
            : null,
      });
      return jsonResponse(payload.result);
    },
  );
}
