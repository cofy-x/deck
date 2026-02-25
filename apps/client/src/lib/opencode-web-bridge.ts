/**
 * @license
 * Copyright 2026 cofy-x
 * SPDX-License-Identifier: Apache-2.0
 */
import { invoke } from '@tauri-apps/api/core';

import { isTauriRuntime } from '@/lib/utils';

export const OPENCODE_BRIDGE_EVENT_AUTH_FAILURE =
  'deck://opencode-bridge-auth-failure';

export interface StartOpencodeWebBridgeInput {
  profileId: string;
  upstreamBaseUrl: string;
  username: string;
  password: string;
  directory?: string;
}

export interface StopOpencodeWebBridgeInput {
  profileId?: string;
}

export interface OpencodeWebBridgeInfo {
  running: boolean;
  profileId: string;
  upstreamBaseUrl: string;
  iframeBaseUrl: string;
  port: number;
}

export async function startOpencodeWebBridge(
  input: StartOpencodeWebBridgeInput,
): Promise<OpencodeWebBridgeInfo> {
  if (!isTauriRuntime()) {
    throw new Error('OpenCode web bridge is only available in Tauri runtime');
  }
  return invoke<OpencodeWebBridgeInfo>('start_opencode_web_bridge', { input });
}

export async function stopOpencodeWebBridge(
  input?: StopOpencodeWebBridgeInput,
): Promise<void> {
  if (!isTauriRuntime()) return;
  await invoke('stop_opencode_web_bridge', { input: input ?? null });
}
