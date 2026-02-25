/**
 * @license
 * Copyright 2026 cofy-x
 * SPDX-License-Identifier: Apache-2.0
 */

import { invoke } from '@tauri-apps/api/core';

export type PilotRuntimeStartInput = {
  workspacePath: string;
  opencodeUrl?: string | null;
  opencodeUsername?: string | null;
  opencodePassword?: string | null;
  bridgeHealthPort?: number | null;
  pilotServerPort?: number | null;
  hostDataDir?: string | null;
};

export type PilotComponentStatus = {
  running: boolean;
  pid: number | null;
  url: string | null;
  lastStdout: string | null;
  lastStderr: string | null;
};

export type PilotRuntimeComponents = {
  host: PilotComponentStatus;
  server: PilotComponentStatus;
  bridge: PilotComponentStatus;
  opencode: PilotComponentStatus;
};

export type PilotRuntimeStatus = {
  running: boolean;
  workspacePath: string | null;
  opencodeUrl: string | null;
  opencodeUsername: string | null;
  opencodePassword: string | null;
  hostDataDir: string | null;
  bridgeHealthPort: number | null;
  components: PilotRuntimeComponents;
};

export type PilotBridgeChannelsHealth = {
  telegram: boolean;
  whatsapp: boolean;
  slack: boolean;
  feishu: boolean;
  discord: boolean;
  dingtalk: boolean;
  email: boolean;
  mochat: boolean;
  qq: boolean;
};

export type PilotBridgeHealthSnapshot = {
  ok: boolean;
  opencode: {
    url: string;
    healthy: boolean;
    version?: string | null;
  };
  channels: PilotBridgeChannelsHealth;
  config: {
    groupsEnabled: boolean;
  };
};

export type PilotServiceHealthStatus = {
  ok: boolean;
  url: string | null;
  error: string | null;
};

export type PilotBridgeServiceHealthStatus = PilotServiceHealthStatus & {
  snapshot: PilotBridgeHealthSnapshot | null;
};

export type PilotRuntimeHealth = {
  ok: boolean;
  host: PilotServiceHealthStatus;
  server: PilotServiceHealthStatus;
  bridge: PilotBridgeServiceHealthStatus;
};

export async function pilotRuntimeStart(
  input: PilotRuntimeStartInput,
): Promise<PilotRuntimeStatus> {
  return invoke<PilotRuntimeStatus>('pilot_runtime_start', {
    input: {
      workspacePath: input.workspacePath,
      opencodeUrl: input.opencodeUrl ?? null,
      opencodeUsername: input.opencodeUsername ?? null,
      opencodePassword: input.opencodePassword ?? null,
      bridgeHealthPort: input.bridgeHealthPort ?? null,
      pilotServerPort: input.pilotServerPort ?? null,
      hostDataDir: input.hostDataDir ?? null,
    },
  });
}

export async function pilotRuntimeStop(): Promise<PilotRuntimeStatus> {
  return invoke<PilotRuntimeStatus>('pilot_runtime_stop');
}

export async function pilotRuntimeStatus(): Promise<PilotRuntimeStatus> {
  return invoke<PilotRuntimeStatus>('pilot_runtime_status');
}

export async function pilotRuntimeHealth(): Promise<PilotRuntimeHealth> {
  return invoke<PilotRuntimeHealth>('pilot_runtime_health');
}
