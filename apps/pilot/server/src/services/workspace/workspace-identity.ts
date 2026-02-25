/**
 * @license
 * Copyright 2026 cofy-x
 * SPDX-License-Identifier: Apache-2.0
 */

import { createHash } from 'node:crypto';
import { basename, resolve } from 'node:path';
import type { WorkspaceConfig, WorkspaceInfo } from '../../types/index.js';

export function workspaceIdForPath(path: string): string {
  const hash = createHash('sha256').update(path).digest('hex');
  return `ws_${hash.slice(0, 12)}`;
}

function normalizeOptional(value: string | undefined): string {
  const trimmed = value?.trim() ?? '';
  return trimmed;
}

export function workspaceIdForConfig(
  workspace: Pick<
    WorkspaceConfig,
    'path' | 'workspaceType' | 'baseUrl' | 'directory'
  >,
  cwd: string,
): string {
  const resolvedPath = resolve(cwd, workspace.path);
  const workspaceType = workspace.workspaceType ?? 'local';
  const baseUrl = normalizeOptional(workspace.baseUrl);
  const directory = normalizeOptional(workspace.directory);
  if (workspaceType === 'local' && !baseUrl && !directory) {
    return workspaceIdForPath(resolvedPath);
  }
  const key = [resolvedPath, workspaceType, baseUrl, directory].join('\0');
  const hash = createHash('sha256').update(key).digest('hex');
  return `ws_${hash.slice(0, 12)}`;
}

export function buildWorkspaceInfos(
  workspaces: WorkspaceConfig[],
  cwd: string,
): WorkspaceInfo[] {
  return workspaces.map((workspace) => {
    const resolvedPath = resolve(cwd, workspace.path);
    const explicitId = workspace.id?.trim();
    const baseUrl = normalizeOptional(workspace.baseUrl) || undefined;
    const directory = normalizeOptional(workspace.directory) || undefined;
    return {
      id: explicitId || workspaceIdForConfig(workspace, cwd),
      name: workspace.name ?? basename(resolvedPath),
      path: resolvedPath,
      workspaceType: workspace.workspaceType ?? 'local',
      baseUrl,
      directory,
      opencodeUsername: normalizeOptional(workspace.opencodeUsername) || undefined,
      opencodePassword: normalizeOptional(workspace.opencodePassword) || undefined,
    };
  });
}
