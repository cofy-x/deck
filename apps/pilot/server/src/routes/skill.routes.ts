/**
 * @license
 * Copyright 2026 cofy-x
 * SPDX-License-Identifier: Apache-2.0
 */

import { readFile } from 'node:fs/promises';
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
import { ApiError } from '../errors.js';
import { resolveWorkspace } from '../services/workspace.service.js';
import { listSkills, upsertSkill } from '../services/skill.service.js';
import {
  includeGlobalQuerySchema,
  upsertSkillBodySchema,
} from '../schemas/route.schema.js';
import { runWorkspaceWriteAction } from './workspace-write.js';

export function registerSkillRoutes(
  routes: Route[],
  config: ServerConfig,
): void {
  addRoute(routes, 'GET', '/workspace/:id/skills', 'client', async (ctx) => {
    const workspace = await resolveWorkspace(config, ctx.params['id'] ?? '');
    const query = validateWithSchema(
      includeGlobalQuerySchema,
      searchParamsToRecord(ctx.url.searchParams),
      'invalid_query',
      'Invalid skill query parameters',
    );
    const includeGlobal = query.includeGlobal === 'true';
    if (includeGlobal) {
      requireHost(ctx.request, config);
    }
    const items = await listSkills(workspace.path, includeGlobal);
    return jsonResponse({ items });
  });

  addRoute(
    routes,
    'GET',
    '/workspace/:id/skills/:name',
    'client',
    async (ctx) => {
      const workspace = await resolveWorkspace(config, ctx.params['id'] ?? '');
      const query = validateWithSchema(
        includeGlobalQuerySchema,
        searchParamsToRecord(ctx.url.searchParams),
        'invalid_query',
        'Invalid skill query parameters',
      );
      const includeGlobal = query.includeGlobal === 'true';
      if (includeGlobal) {
        requireHost(ctx.request, config);
      }
      const name = String(ctx.params['name'] ?? '').trim();
      if (!name) {
        throw new ApiError(400, 'invalid_skill_name', 'Skill name is required');
      }
      const items = await listSkills(workspace.path, includeGlobal);
      const item = items.find((skill) => skill.name === name);
      if (!item) {
        throw new ApiError(404, 'skill_not_found', `Skill not found: ${name}`);
      }
      const content = await readFile(item.path, 'utf8');
      return jsonResponse({ item, content });
    },
  );

  addRoute(routes, 'POST', '/workspace/:id/skills', 'client', async (ctx) => {
    const body = await readAndValidateJsonBody(ctx.request, upsertSkillBodySchema);
    const name = body.name;
    const result = await runWorkspaceWriteAction({
      config,
      ctx,
      approval: (workspace) => ({
        action: 'skills.upsert',
        summary: `Upsert skill ${name}`,
        paths: [join(workspace.path, '.opencode', 'skills', name, 'SKILL.md')],
      }),
      mutate: async (workspace) =>
        upsertSkill(workspace.path, {
          name,
          content: body.content,
          description: body.description,
        }),
      audit: (_, payload) => ({
        action: 'skills.upsert',
        target: payload.path,
        summary: `Upserted skill ${name}`,
      }),
      reload: (_, payload) => ({
        reason: 'skills',
        trigger: {
          type: 'skill',
          name,
          action: payload.action,
          path: payload.path,
        },
      }),
    });
    return jsonResponse({
      name,
      path: result.path,
      description: body.description ?? '',
      scope: 'project',
    });
  });
}
