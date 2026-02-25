/**
 * @license
 * Copyright 2026 cofy-x
 * SPDX-License-Identifier: Apache-2.0
 */

// ---------------------------------------------------------------------------
// Bridge health
// ---------------------------------------------------------------------------

export type BridgeChannelName =
  | 'telegram'
  | 'whatsapp'
  | 'slack'
  | 'feishu'
  | 'discord'
  | 'dingtalk'
  | 'email'
  | 'mochat'
  | 'qq';

export type BridgeChannelsHealth = Record<BridgeChannelName, boolean>;

export interface BridgeHealthSnapshot {
  ok: boolean;
  opencode: {
    url: string;
    healthy: boolean;
    version?: string;
  };
  channels: BridgeChannelsHealth;
  config: {
    groupsEnabled: boolean;
  };
}

// ---------------------------------------------------------------------------
// OpenCode health
// ---------------------------------------------------------------------------

export interface OpencodeHealthData {
  healthy: boolean;
}

export interface OpencodeHealthResponse {
  data?: OpencodeHealthData;
}

// ---------------------------------------------------------------------------
// OpenCode path
// ---------------------------------------------------------------------------

export interface OpencodePathData {
  cwd?: string;
  root?: string;
}

export interface OpencodePathResponse {
  data?: OpencodePathData;
}

// ---------------------------------------------------------------------------
// Pilot server responses
// ---------------------------------------------------------------------------

export interface PilotHealthResponse {
  version?: string;
}

export interface PilotWorkspaceOpencode {
  baseUrl?: string;
  directory?: string;
  username?: string;
  password?: string;
}

export interface PilotWorkspaceItem {
  id?: string;
  path?: string;
  opencode?: PilotWorkspaceOpencode;
}

export interface PilotWorkspacesResponse {
  activeId?: string | null;
  items?: PilotWorkspaceItem[];
}

// ---------------------------------------------------------------------------
// Instance dispose
// ---------------------------------------------------------------------------

export interface InstanceDisposeResult {
  ok?: boolean;
}

// ---------------------------------------------------------------------------
// Status command types
// ---------------------------------------------------------------------------

export interface ServiceHealthStatus {
  ok: boolean;
  url: string;
  error?: string;
}

export interface ServiceHealthStatusWithData<THealth> extends ServiceHealthStatus {
  health?: THealth;
}

export interface StatusResult {
  pilot?: ServiceHealthStatus;
  opencode?: ServiceHealthStatusWithData<OpencodeHealthData>;
  bridge?: ServiceHealthStatusWithData<BridgeHealthSnapshot>;
}
