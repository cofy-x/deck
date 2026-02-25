/**
 * @license
 * Copyright 2026 cofy-x
 * SPDX-License-Identifier: Apache-2.0
 */

import type {
  ReloadReason,
  ReloadTrigger,
  ServerConfig,
  WorkspaceInfo,
} from '../types/index.js';
import type { RequestContext } from '../http/router.js';
import { requireApproval } from '../http/response.js';
import { ApiError } from '../errors.js';
import { recordAudit } from '../services/audit.service.js';
import {
  ensureWritable,
  resolveWorkspace,
} from '../services/workspace.service.js';
import { shortId } from '../utils/crypto.js';

interface ApprovalSpec {
  action: string;
  summary: string;
  paths: string[];
}

interface AuditSpec {
  action: string;
  target: string;
  summary: string;
}

interface ReloadSpec {
  reason: ReloadReason;
  trigger?: ReloadTrigger;
}

export interface RunWorkspaceWriteActionInput<TResult> {
  config: ServerConfig;
  ctx: RequestContext;
  requireWritable?: boolean;
  approval: (workspace: WorkspaceInfo) => ApprovalSpec | Promise<ApprovalSpec>;
  mutate: (workspace: WorkspaceInfo) => Promise<TResult>;
  audit?: (workspace: WorkspaceInfo, result: TResult) => AuditSpec | null;
  reload?: (workspace: WorkspaceInfo, result: TResult) => ReloadSpec | null;
}

function createPartialFailureError(input: {
  stage: 'audit' | 'reload';
  workspaceId: string;
  action: string;
  requestId?: string;
  error: unknown;
}): ApiError {
  const message =
    input.error instanceof Error
      ? input.error.message
      : String(input.error);
  return new ApiError(
    500,
    'write_partially_applied',
    'Write applied but post-processing failed',
    {
      mutated: true,
      stage: input.stage,
      workspaceId: input.workspaceId,
      action: input.action,
      requestId: input.requestId ?? null,
      cause: message,
    },
  );
}

function logPostWriteFailure(input: {
  stage: 'audit' | 'reload';
  workspaceId: string;
  action: string;
  requestId?: string;
  error: unknown;
}): void {
  const message =
    input.error instanceof Error
      ? input.error.message
      : String(input.error);
  console.warn(
    JSON.stringify({
      event: 'workspace_write_post_failure',
      stage: input.stage,
      workspaceId: input.workspaceId,
      action: input.action,
      requestId: input.requestId ?? null,
      error: message,
    }),
  );
}

export async function runWorkspaceWriteAction<TResult>(
  input: RunWorkspaceWriteActionInput<TResult>,
): Promise<TResult> {
  const {
    config,
    ctx,
    approval,
    mutate,
    audit,
    reload,
    requireWritable = true,
  } = input;

  if (requireWritable) {
    ensureWritable(config);
  }

  const workspace = await resolveWorkspace(config, ctx.params['id'] ?? '');
  const approvalSpec = await approval(workspace);
  await requireApproval(ctx, {
    workspaceId: workspace.id,
    action: approvalSpec.action,
    summary: approvalSpec.summary,
    paths: approvalSpec.paths,
  });

  const result = await mutate(workspace);
  const requestId = ctx.request.headers.get('x-request-id') ?? undefined;

  const auditSpec = audit?.(workspace, result) ?? null;
  if (auditSpec) {
    try {
      await recordAudit(workspace.path, {
        id: shortId(),
        workspaceId: workspace.id,
        actor: ctx.actor ?? { type: 'remote' },
        action: auditSpec.action,
        target: auditSpec.target,
        summary: auditSpec.summary,
        timestamp: Date.now(),
      });
    } catch (error) {
      logPostWriteFailure({
        stage: 'audit',
        workspaceId: workspace.id,
        action: auditSpec.action,
        requestId,
        error,
      });
      throw createPartialFailureError({
        stage: 'audit',
        workspaceId: workspace.id,
        action: auditSpec.action,
        requestId,
        error,
      });
    }
  }

  const reloadSpec = reload?.(workspace, result) ?? null;
  if (reloadSpec) {
    try {
      ctx.reloadEvents.record(
        workspace.id,
        reloadSpec.reason,
        reloadSpec.trigger,
      );
    } catch (error) {
      logPostWriteFailure({
        stage: 'reload',
        workspaceId: workspace.id,
        action: approvalSpec.action,
        requestId,
        error,
      });
      throw createPartialFailureError({
        stage: 'reload',
        workspaceId: workspace.id,
        action: approvalSpec.action,
        requestId,
        error,
      });
    }
  }

  return result;
}
