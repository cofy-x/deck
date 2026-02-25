/**
 * @license
 * Copyright 2026 cofy-x
 * SPDX-License-Identifier: Apache-2.0
 */

import type { Route } from '../http/router.js';
import { addRoute } from '../http/router.js';
import {
  jsonResponse,
  readAndValidateJsonBody,
  validateWithSchema,
} from '../http/response.js';
import { ApiError } from '../errors.js';
import {
  approvalIdParamsSchema,
  approvalReplyBodySchema,
} from '../schemas/route.schema.js';

export function registerApprovalRoutes(routes: Route[]): void {
  addRoute(routes, 'GET', '/approvals', 'host', async (ctx) =>
    jsonResponse({ items: ctx.approvals.list() }),
  );

  addRoute(routes, 'POST', '/approvals/:id', 'host', async (ctx) => {
    const params = validateWithSchema(
      approvalIdParamsSchema,
      ctx.params,
      'invalid_params',
      'Invalid approval id',
    );
    const body = await readAndValidateJsonBody(
      ctx.request,
      approvalReplyBodySchema,
    );
    const result = ctx.approvals.respond(params.id, body.reply);
    if (!result) {
      throw new ApiError(
        404,
        'approval_not_found',
        'Approval request not found',
      );
    }
    return jsonResponse({ ok: true, allowed: result.allowed });
  });
}
