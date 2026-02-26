/**
 * @license
 * Copyright 2026 cofy-x
 * SPDX-License-Identifier: Apache-2.0
 *
 * Thin wrappers around the Tauri credential-store commands.
 * All functions are no-ops when running outside Tauri (browser dev mode).
 */
import { invoke } from '@tauri-apps/api/core';

import { isTauriRuntime } from './utils';

// ---------------------------------------------------------------------------
// Types (mirror Rust serde output — camelCase)
// ---------------------------------------------------------------------------

export interface StoredCredential {
  profileId: string;
  providerId: string;
  authType: string;
  authData: string;
}

export interface StoredCustomProvider {
  profileId: string;
  providerId: string;
  providerName: string;
  providerConfig: string;
}

// ---------------------------------------------------------------------------
// Credential operations
// ---------------------------------------------------------------------------

export async function saveCredential(
  profileId: string,
  providerId: string,
  authType: string,
  authData: string,
): Promise<void> {
  if (!isTauriRuntime()) return;
  await invoke('save_credential', {
    input: { profileId, providerId, authType, authData },
  });
}

export async function listCredentials(
  profileId: string,
): Promise<StoredCredential[]> {
  if (!isTauriRuntime()) return [];
  return invoke('list_credentials', { profileId });
}

export async function removeCredential(
  profileId: string,
  providerId: string,
): Promise<void> {
  if (!isTauriRuntime()) return;
  await invoke('remove_credential', {
    input: { profileId, providerId },
  });
}

// ---------------------------------------------------------------------------
// Custom provider operations
// ---------------------------------------------------------------------------

export async function saveCustomProvider(
  profileId: string,
  providerId: string,
  providerName: string,
  providerConfig: string,
): Promise<void> {
  if (!isTauriRuntime()) return;
  await invoke('save_custom_provider', {
    input: { profileId, providerId, providerName, providerConfig },
  });
}

export async function listCustomProviders(
  profileId: string,
): Promise<StoredCustomProvider[]> {
  if (!isTauriRuntime()) return [];
  return invoke('list_custom_providers', { profileId });
}

export async function removeCustomProvider(
  profileId: string,
  providerId: string,
): Promise<void> {
  if (!isTauriRuntime()) return;
  await invoke('remove_custom_provider', {
    input: { profileId, providerId },
  });
}
