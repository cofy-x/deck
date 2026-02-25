/**
 * @license
 * Copyright 2026 cofy-x
 * SPDX-License-Identifier: Apache-2.0
 */

import type { ServerConfig } from '../types/index.js';
import type { Route } from '../http/router.js';
import type { RequestContext } from '../http/router.js';
import { addRoute } from '../http/router.js';
import { jsonResponse, requireApproval } from '../http/response.js';
import { ApiError } from '../errors.js';
import {
  deleteResolvedScheduledJob,
  listScheduledJobs,
  resolveScheduledJobBySlug,
} from '../services/scheduler.service.js';
import { recordGlobalAudit } from '../services/audit.service.js';
import { ensureWritable } from '../services/workspace.service.js';
import { shortId } from '../utils/crypto.js';

function deleteScheduledJobRoute(config: ServerConfig) {
  return async (ctx: RequestContext) => {
    ensureWritable(config);
    const slug = ctx.params['slug'] ?? '';
    const resolved = await resolveScheduledJobBySlug(slug);
    await requireApproval(ctx, {
      workspaceId: 'scheduler',
      action: 'scheduler.delete',
      summary: `Delete scheduled job ${resolved.job.name}`,
      paths: [resolved.jobFile, ...resolved.systemPaths],
    });

    await deleteResolvedScheduledJob(resolved);
    const job = resolved.job;
    try {
      await recordGlobalAudit({
        id: shortId(),
        workspaceId: 'scheduler',
        actor: ctx.actor ?? { type: 'remote' },
        action: 'scheduler.delete',
        target: `scheduler.job:${job.slug}`,
        summary: `Deleted scheduled job ${job.name}`,
        timestamp: Date.now(),
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : String(error);
      throw new ApiError(
        500,
        'write_partially_applied',
        'Write applied but post-processing failed',
        {
          mutated: true,
          stage: 'audit',
          workspaceId: 'scheduler',
          action: 'scheduler.delete',
          requestId: ctx.request.headers.get('x-request-id') ?? null,
          cause: message,
        },
      );
    }
    return jsonResponse({ job });
  };
}

export function registerSchedulerRoutes(
  routes: Route[],
  config: ServerConfig,
): void {
  addRoute(routes, 'GET', '/scheduler/jobs', 'client', async () => {
    const items = await listScheduledJobs();
    return jsonResponse({ items });
  });

  addRoute(
    routes,
    'DELETE',
    '/scheduler/jobs/:slug',
    'client',
    deleteScheduledJobRoute(config),
  );
}
