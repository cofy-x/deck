/**
 * @license
 * Copyright 2026 cofy-x
 * SPDX-License-Identifier: Apache-2.0
 */

import type { BinaryDiagnostics, SidecarDiagnostics } from './binary.js';
import type { ApprovalMode } from './cli.js';

// ---------------------------------------------------------------------------
// Start payload sub-types
// ---------------------------------------------------------------------------

export interface StartApprovalConfig {
  mode: ApprovalMode;
  timeoutMs: number;
  readOnly: boolean;
}

export interface StartOpencodeConfig {
  baseUrl: string;
  connectUrl: string;
  managedByHost: boolean;
  username?: string;
  password?: string;
  bindHost: string;
  port: number;
  version?: string;
}

export interface StartPilotConfig {
  baseUrl: string;
  connectUrl: string;
  managedByHost: boolean;
  host: string;
  port: number;
  token: string;
  hostToken: string;
  version?: string;
}

export interface StartBridgeConfig {
  enabled: boolean;
  managedByHost: boolean;
  version?: string;
  healthPort: number;
  healthUrl: string;
}

export interface StartBinaryDiagnostics {
  opencode: BinaryDiagnostics;
  pilotServer: BinaryDiagnostics;
  bridge: BinaryDiagnostics | null;
}

export interface StartDiagnostics {
  cliVersion: string;
  sidecar: SidecarDiagnostics;
  binaries: StartBinaryDiagnostics;
}

// ---------------------------------------------------------------------------
// Aggregated start payload
// ---------------------------------------------------------------------------

export interface StartPayload {
  runId: string;
  workspace: string;
  approval: StartApprovalConfig;
  opencode: StartOpencodeConfig;
  pilot: StartPilotConfig;
  bridge: StartBridgeConfig;
  diagnostics: StartDiagnostics;
}
