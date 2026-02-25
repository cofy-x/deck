/**
 * @license
 * Copyright 2026 cofy-x
 * SPDX-License-Identifier: Apache-2.0
 */

export {
  resolveRouterDataDir,
  resolveSidecarConfig,
  resolveSidecarTarget,
} from './binary/config.js';
export {
  clearRemoteManifestCacheForTesting,
  fetchRemoteManifest,
  fetchRemoteManifestForTesting,
  resolveManifestCandidates,
} from './binary/manifest.js';
export {
  downloadSidecarBinary,
  ensureExecutable,
  resolveOpencodeDownload,
} from './binary/download.js';
export {
  resolveBridgeBin,
  resolveOpencodeBin,
  resolvePilotServerBin,
} from './binary/resolver.js';
export {
  assertVersionMatch,
  readCliVersion,
  readVersionManifest,
  resolveBundledBinary,
  resolveExpectedVersion,
  verifyBinary,
} from './binary/version.js';
export type { ManifestCandidate } from './binary/manifest.js';
