/**
 * @license
 * Copyright 2026 cofy-x
 * SPDX-License-Identifier: Apache-2.0
 */

import type { JsonObject, ServerConfig } from '../types/index.js';
import type { Route } from '../http/router.js';
import { addRoute } from '../http/router.js';
import { jsonResponse, readAndValidateJsonBody } from '../http/response.js';
import { resolveWorkspace } from '../services/workspace.service.js';
import { addMcp, listMcp, removeMcp } from '../services/mcp.service.js';
import { opencodeConfigPath } from '../utils/workspace-files.js';
import { addMcpBodySchema } from '../schemas/route.schema.js';
import { runWorkspaceWriteAction } from './workspace-write.js';

export function registerMcpRoutes(routes: Route[], config: ServerConfig): void {
  addRoute(routes, 'GET', '/workspace/:id/mcp', 'client', async (ctx) => {
    const workspace = await resolveWorkspace(config, ctx.params['id'] ?? '');
    const items = await listMcp(workspace.path);
    return jsonResponse({ items });
  });

  addRoute(routes, 'POST', '/workspace/:id/mcp', 'client', async (ctx) => {
    const body = await readAndValidateJsonBody(ctx.request, addMcpBodySchema);
    const name = body.name;
    const configPayload: JsonObject = body.config;
    const payload = await runWorkspaceWriteAction({
      config,
      ctx,
      approval: (workspace) => ({
        action: 'mcp.add',
        summary: `Add MCP ${name}`,
        paths: [opencodeConfigPath(workspace.path)],
      }),
      mutate: async (workspace) => {
        const result = await addMcp(workspace.path, name, configPayload);
        const items = await listMcp(workspace.path);
        return { result, items };
      },
      audit: () => ({
        action: 'mcp.add',
        target: 'opencode.json',
        summary: `Added MCP ${name}`,
      }),
      reload: (_, result) => ({
        reason: 'mcp',
        trigger: {
          type: 'mcp',
          name,
          action: result.result.action,
        },
      }),
    });
    return jsonResponse({ items: payload.items });
  });

  addRoute(
    routes,
    'DELETE',
    '/workspace/:id/mcp/:name',
    'client',
    async (ctx) => {
      const name = ctx.params['name'] ?? '';
      const payload = await runWorkspaceWriteAction({
        config,
        ctx,
        approval: (workspace) => ({
          action: 'mcp.remove',
          summary: `Remove MCP ${name}`,
          paths: [opencodeConfigPath(workspace.path)],
        }),
        mutate: async (workspace) => {
          const removed = await removeMcp(workspace.path, name);
          const items = await listMcp(workspace.path);
          return { removed, items };
        },
        audit: () => ({
          action: 'mcp.remove',
          target: 'opencode.json',
          summary: `Removed MCP ${name}`,
        }),
        reload: (_, result) =>
          result.removed
            ? {
                reason: 'mcp',
                trigger: { type: 'mcp', name, action: 'removed' },
              }
            : null,
      });
      return jsonResponse({ items: payload.items });
    },
  );
}
