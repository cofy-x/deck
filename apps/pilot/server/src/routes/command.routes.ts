/**
 * @license
 * Copyright 2026 cofy-x
 * SPDX-License-Identifier: Apache-2.0
 */

import { join } from 'node:path';
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
  deleteCommand,
  listCommands,
  upsertCommand,
} from '../services/command.service.js';
import { sanitizeCommandName } from '../utils/validators.js';
import {
  scopeQuerySchema,
  upsertCommandBodySchema,
} from '../schemas/route.schema.js';
import { runWorkspaceWriteAction } from './workspace-write.js';

export function registerCommandRoutes(
  routes: Route[],
  config: ServerConfig,
): void {
  addRoute(routes, 'GET', '/workspace/:id/commands', 'client', async (ctx) => {
    const query = validateWithSchema(
      scopeQuerySchema,
      searchParamsToRecord(ctx.url.searchParams),
      'invalid_query',
      'Invalid command query parameters',
    );
    const scope = query.scope ?? 'workspace';
    if (scope === 'global') {
      requireHost(ctx.request, config);
    }
    const workspace = await resolveWorkspace(config, ctx.params['id'] ?? '');
    const items = await listCommands(workspace.path, scope);
    return jsonResponse({ items });
  });

  addRoute(routes, 'POST', '/workspace/:id/commands', 'client', async (ctx) => {
    const body = await readAndValidateJsonBody(ctx.request, upsertCommandBodySchema);
    const name = body.name;
    const normalizedName = sanitizeCommandName(name);
    await runWorkspaceWriteAction({
      config,
      ctx,
      approval: (workspace) => ({
        action: 'commands.upsert',
        summary: `Upsert command ${name}`,
        paths: [
          join(workspace.path, '.opencode', 'commands', `${normalizedName}.md`),
        ],
      }),
      mutate: async (workspace) =>
        upsertCommand(workspace.path, {
          name,
          template: body.template,
          description: body.description,
          agent: body.agent,
          model: body.model,
          subtask: body.subtask,
        }),
      audit: (_, targetPath) => ({
        action: 'commands.upsert',
        target: targetPath,
        summary: `Upserted command ${name}`,
      }),
      reload: (_, targetPath) => ({
        reason: 'commands',
        trigger: {
          type: 'command',
          name: normalizedName,
          action: 'updated',
          path: targetPath,
        },
      }),
    });
    const workspace = await resolveWorkspace(config, ctx.params['id'] ?? '');
    const items = await listCommands(workspace.path, 'workspace');
    return jsonResponse({ items });
  });

  addRoute(
    routes,
    'DELETE',
    '/workspace/:id/commands/:name',
    'client',
    async (ctx) => {
      const name = ctx.params['name'] ?? '';
      const normalizedName = sanitizeCommandName(name);
      await runWorkspaceWriteAction({
        config,
        ctx,
        approval: (workspace) => ({
          action: 'commands.delete',
          summary: `Delete command ${name}`,
          paths: [
            join(workspace.path, '.opencode', 'commands', `${normalizedName}.md`),
          ],
        }),
        mutate: async (workspace) => {
          await deleteCommand(workspace.path, name);
          return join(workspace.path, '.opencode', 'commands', `${normalizedName}.md`);
        },
        audit: (workspace) => ({
          action: 'commands.delete',
          target: join(workspace.path, '.opencode', 'commands'),
          summary: `Deleted command ${name}`,
        }),
        reload: (_, targetPath) => ({
          reason: 'commands',
          trigger: {
            type: 'command',
            name: normalizedName,
            action: 'removed',
            path: targetPath,
          },
        }),
      });
      return jsonResponse({ ok: true });
    },
  );
}
