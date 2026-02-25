/**
 * @license
 * Copyright 2026 cofy-x
 * SPDX-License-Identifier: Apache-2.0
 */

import { realpath } from 'node:fs/promises';
import { resolve, sep } from 'node:path';
import type { ServerConfig, WorkspaceInfo } from '../../types/index.js';
import { ApiError } from '../../errors.js';

async function resolveRealPath(path: string): Promise<string> {
  try {
    return await realpath(path);
  } catch {
    return resolve(path);
  }
}

async function isAuthorizedRoot(
  workspacePath: string,
  roots: string[],
): Promise<boolean> {
  const resolvedWorkspace = await resolveRealPath(workspacePath);
  for (const root of roots) {
    const resolvedRoot = await resolveRealPath(root);
    if (resolvedWorkspace === resolvedRoot) return true;
    if (resolvedWorkspace.startsWith(resolvedRoot + sep)) return true;
  }
  return false;
}

export async function resolveWorkspace(
  config: ServerConfig,
  id: string,
): Promise<WorkspaceInfo> {
  const workspace = config.workspaces.find((entry) => entry.id === id);
  if (!workspace) {
    throw new ApiError(404, 'workspace_not_found', 'Workspace not found');
  }

  const resolvedWorkspace = await resolveRealPath(workspace.path);
  const authorized = await isAuthorizedRoot(
    resolvedWorkspace,
    config.authorizedRoots,
  );
  if (!authorized) {
    throw new ApiError(
      403,
      'workspace_unauthorized',
      'Workspace is not authorized',
    );
  }

  return { ...workspace, path: resolvedWorkspace };
}

export async function listAuthorizedWorkspaces(
  config: ServerConfig,
): Promise<WorkspaceInfo[]> {
  const authorized: WorkspaceInfo[] = [];
  for (const workspace of config.workspaces) {
    const resolvedWorkspace = await resolveRealPath(workspace.path);
    const allowed = await isAuthorizedRoot(
      resolvedWorkspace,
      config.authorizedRoots,
    );
    if (!allowed) continue;
    authorized.push({ ...workspace, path: resolvedWorkspace });
  }
  return authorized;
}

export async function resolveActiveWorkspace(
  config: ServerConfig,
): Promise<WorkspaceInfo> {
  const active = config.workspaces[0];
  if (!active) {
    throw new ApiError(
      409,
      'no_active_workspace',
      'No active workspace configured',
    );
  }
  return resolveWorkspace(config, active.id);
}
