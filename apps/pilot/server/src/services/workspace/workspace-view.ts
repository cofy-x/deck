/**
 * @license
 * Copyright 2026 cofy-x
 * SPDX-License-Identifier: Apache-2.0
 */

import type {
  Capabilities,
  SerializedWorkspace,
  WorkspaceOpencodeView,
  WorkspaceInfo,
} from '../../types/index.js';
import { resolveOpencodeDirectory } from './opencode-client.js';

export function toSerializedWorkspace(
  workspace: WorkspaceInfo,
): SerializedWorkspace {
  const opencodeDirectory = resolveOpencodeDirectory(workspace);
  const hasCredentials =
    Boolean(workspace.opencodeUsername?.trim()) &&
    Boolean(workspace.opencodePassword?.trim());
  const opencode: WorkspaceOpencodeView | undefined =
    workspace.baseUrl || opencodeDirectory || hasCredentials
      ? {
          baseUrl: workspace.baseUrl,
          directory: opencodeDirectory ?? undefined,
          username: workspace.opencodeUsername,
          password: workspace.opencodePassword,
        }
      : undefined;
  return {
    id: workspace.id,
    name: workspace.name,
    path: workspace.path,
    workspaceType: workspace.workspaceType,
    opencode,
  };
}

export function serializeWorkspace(workspace: WorkspaceInfo): SerializedWorkspace {
  return toSerializedWorkspace(workspace);
}

export function buildCapabilities(readOnly: boolean): Capabilities {
  const writeEnabled = !readOnly;
  return {
    skills: { read: true, write: writeEnabled, source: 'pilot' },
    plugins: { read: true, write: writeEnabled },
    mcp: { read: true, write: writeEnabled },
    commands: { read: true, write: writeEnabled },
    config: { read: true, write: writeEnabled },
  };
}
