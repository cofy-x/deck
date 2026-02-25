/**
 * @license
 * Copyright 2026 cofy-x
 * SPDX-License-Identifier: Apache-2.0
 */

export { copyToClipboard } from './clipboard.js';

export {
  ensureWorkspace,
  FALLBACK_VERSION,
  fileExists,
  isExecutable,
  readPackageField,
  readPackageVersion,
  resolveCliVersion,
  sha256File,
} from './fs.js';

export { buildAttachCommand, printHelp } from './help.js';

export {
  fetchJson,
  outputError,
  outputResult,
  waitForHealthy,
} from './http.js';

export {
  canBind,
  encodeBasicAuth,
  findFreePort,
  resolveConnectUrl,
  resolveLanIp,
  resolvePort,
} from './network.js';

export {
  captureCommandOutput,
  DEFAULT_APPROVAL_TIMEOUT,
  DEFAULT_OPENCODE_USERNAME,
  DEFAULT_PILOT_PORT,
  DEFAULT_BRIDGE_HEALTH_PORT,
  findWorkspace,
  isProcessAlive,
  normalizeEvent,
  normalizeWorkspacePath,
  nowMs,
  prefixStream,
  resolveBinCommand,
  resolveBinPath,
  resolveSelfCommand,
  runCommand,
  stopChild,
  workspaceIdForLocal,
  workspaceIdForRemote,
} from './process.js';

export { pollUntil, sleep } from './poll.js';
