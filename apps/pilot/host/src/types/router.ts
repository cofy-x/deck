/**
 * @license
 * Copyright 2026 cofy-x
 * SPDX-License-Identifier: Apache-2.0
 */

import type {
  BinarySource,
  BinarySourcePreference,
  SidecarTarget,
} from './binary.js';

// ---------------------------------------------------------------------------
// Workspace
// ---------------------------------------------------------------------------

export type RouterWorkspaceType = 'local' | 'remote';

export interface RouterWorkspace {
  id: string;
  name: string;
  path: string;
  workspaceType: RouterWorkspaceType;
  baseUrl?: string;
  directory?: string;
  createdAt: number;
  lastUsedAt?: number;
}

// ---------------------------------------------------------------------------
// Router daemon / opencode state
// ---------------------------------------------------------------------------

export interface RouterDaemonState {
  pid: number;
  port: number;
  baseUrl: string;
  startedAt: number;
}

export interface RouterOpencodeState {
  pid: number;
  port: number;
  baseUrl: string;
  startedAt: number;
}

// ---------------------------------------------------------------------------
// Binary info persisted in router state
// ---------------------------------------------------------------------------

export interface RouterBinaryInfo {
  path: string;
  source: BinarySource;
  expectedVersion?: string;
  actualVersion?: string;
}

export interface RouterBinaryState {
  opencode?: RouterBinaryInfo;
}

// ---------------------------------------------------------------------------
// Sidecar state persisted in router state
// ---------------------------------------------------------------------------

export interface RouterSidecarState {
  dir: string;
  baseUrl: string;
  manifestUrl: string;
  target: SidecarTarget | null;
  source: BinarySourcePreference;
  opencodeSource: BinarySourcePreference;
  allowExternal: boolean;
}

// ---------------------------------------------------------------------------
// Aggregated router state
// ---------------------------------------------------------------------------

export interface RouterState {
  version: number;
  daemon?: RouterDaemonState;
  opencode?: RouterOpencodeState;
  cliVersion?: string;
  sidecar?: RouterSidecarState;
  binaries?: RouterBinaryState;
  activeId: string;
  workspaces: RouterWorkspace[];
}

// ---------------------------------------------------------------------------
// Request body types for router HTTP handler
// ---------------------------------------------------------------------------

export interface AddWorkspaceRequestBody {
  path?: string;
  name?: string;
}

export interface AddRemoteWorkspaceRequestBody {
  baseUrl?: string;
  directory?: string;
  name?: string;
}
