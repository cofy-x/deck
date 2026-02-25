/**
 * @license
 * Copyright 2026 cofy-x
 * SPDX-License-Identifier: Apache-2.0
 */

import type { Capabilities, ServerConfig } from '../types/index.js';
import { buildCapabilities as buildCapabilitiesImpl } from './workspace/workspace-view.js';
import { ensureWritable as ensureWritableImpl } from './workspace/workspace-policy.js';

export {
  workspaceIdForPath,
  workspaceIdForConfig,
  buildWorkspaceInfos,
} from './workspace/workspace-identity.js';

export {
  resolveWorkspace,
  listAuthorizedWorkspaces,
  resolveActiveWorkspace,
} from './workspace/workspace-registry.js';

export {
  toSerializedWorkspace,
  serializeWorkspace,
} from './workspace/workspace-view.js';

export { buildConfigTrigger } from './workspace/workspace-policy.js';

export {
  readOpencodeConfig,
  readPilotConfig,
  writePilotConfig,
} from './workspace/workspace-config-repository.js';

export {
  resolveOpencodeDirectory,
  buildOpencodeAuthHeader,
  reloadOpencodeEngine,
} from './workspace/opencode-client.js';

export { exportWorkspace, importWorkspace } from './workspace/workspace-transfer-service.js';

export function buildCapabilities(config: ServerConfig): Capabilities {
  return buildCapabilitiesImpl(config.readOnly);
}

export function ensureWritable(config: ServerConfig): void {
  ensureWritableImpl(config.readOnly);
}
