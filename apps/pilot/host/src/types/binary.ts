/**
 * @license
 * Copyright 2026 cofy-x
 * SPDX-License-Identifier: Apache-2.0
 */

// ---------------------------------------------------------------------------
// Version & integrity
// ---------------------------------------------------------------------------

export interface VersionInfo {
  version: string;
  sha256: string;
}

// ---------------------------------------------------------------------------
// Sidecar identification
// ---------------------------------------------------------------------------

export type SidecarName = 'pilot-server' | 'bridge' | 'opencode';

export type SidecarTarget =
  | 'darwin-arm64'
  | 'darwin-x64'
  | 'linux-x64'
  | 'linux-arm64'
  | 'windows-x64'
  | 'windows-arm64';

// ---------------------------------------------------------------------------
// Version manifest (bundled alongside the CLI binary)
// ---------------------------------------------------------------------------

export type SidecarVersionEntries = {
  [K in SidecarName]?: VersionInfo;
};

export interface VersionManifest {
  dir: string;
  entries: SidecarVersionEntries;
}

// ---------------------------------------------------------------------------
// Remote sidecar manifest (downloaded at runtime)
// ---------------------------------------------------------------------------

export interface RemoteSidecarAsset {
  asset?: string;
  url?: string;
  sha256?: string;
  size?: number;
}

export type SidecarTargetAssets = {
  [K in SidecarTarget]?: RemoteSidecarAsset;
};

export interface RemoteSidecarEntry {
  version: string;
  targets: SidecarTargetAssets;
}

export type RemoteSidecarEntries = {
  [K in SidecarName]?: RemoteSidecarEntry;
};

export interface RemoteSidecarManifest {
  version: string;
  generatedAt?: string;
  entries: RemoteSidecarEntries;
}

// ---------------------------------------------------------------------------
// Sidecar configuration
// ---------------------------------------------------------------------------

export interface SidecarConfig {
  dir: string;
  baseUrl: string;
  manifestUrl: string;
  target: SidecarTarget | null;
}

// ---------------------------------------------------------------------------
// Binary resolution
// ---------------------------------------------------------------------------

export type BinarySource = 'bundled' | 'external' | 'downloaded';

export type BinarySourcePreference =
  | 'auto'
  | 'bundled'
  | 'downloaded'
  | 'external';

export interface ResolvedBinary {
  bin: string;
  source: BinarySource;
  expectedVersion?: string;
}

export interface BinaryDiagnostics {
  path: string;
  source: BinarySource;
  expectedVersion?: string;
  actualVersion?: string;
}

export interface SidecarDiagnostics {
  dir: string;
  baseUrl: string;
  manifestUrl: string;
  target: SidecarTarget | null;
  source: BinarySourcePreference;
  opencodeSource: BinarySourcePreference;
  allowExternal: boolean;
}

export interface ResolveBinaryOptions {
  explicit?: string;
  manifest: VersionManifest | null;
  allowExternal: boolean;
  sidecar: SidecarConfig;
  source: BinarySourcePreference;
}
