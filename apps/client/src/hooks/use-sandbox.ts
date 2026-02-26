/**
 * @license
 * Copyright 2026 cofy-x
 * SPDX-License-Identifier: Apache-2.0
 */
import { useEffect, useRef } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { invoke } from '@tauri-apps/api/core';

import { useActiveConnection } from '@/hooks/use-connection';
import { CONFIG_KEYS } from '@/hooks/use-config';
import { createClient, unwrap, waitForHealthy } from '@/lib/opencode';
import {
  listCredentials,
  listCustomProviders,
} from '@/lib/credential-store';
import { useProjectStore } from '@/stores/project-store';
import {
  useSandboxStore,
  type SandboxStatusValue,
} from '@/stores/sandbox-store';

// ---------------------------------------------------------------------------
// Types matching Rust structs
// ---------------------------------------------------------------------------

interface SandboxPorts {
  opencode: number;
  vnc: number;
  novnc: number;
  daemon: number;
  ssh: number;
  web_terminal: number;
}

interface SandboxStatus {
  running: boolean;
  container_name: string | null;
  container_id: string | null;
  ports: SandboxPorts;
}

interface DockerInfo {
  available: boolean;
  error: string | null;
}

interface SandboxConfig {
  image?: string;
  container_name?: string;
}

// ---------------------------------------------------------------------------
// Query keys
// ---------------------------------------------------------------------------

export const SANDBOX_KEYS = {
  status: (scope: string) => ['sandbox', 'status', scope] as const,
  docker: (scope: string) => ['sandbox', 'docker', scope] as const,
};

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

interface ServerConnectionInput {
  baseUrl: string;
  username?: string;
  password?: string;
}

function buildClient(input: ServerConnectionInput) {
  return createClient({
    baseUrl: input.baseUrl,
    auth:
      input.username && input.password
        ? { username: input.username, password: input.password }
        : undefined,
  });
}

async function verifyRemoteConnection(input: ServerConnectionInput) {
  const client = buildClient(input);
  await waitForHealthy(client, { timeoutMs: 10_000, pollMs: 500 });
}

async function fetchDefaultProjectDirectory(
  input: ServerConnectionInput & {
    healthTimeoutMs?: number;
    healthPollMs?: number;
  },
): Promise<string | null> {
  try {
    const client = buildClient(input);
    await waitForHealthy(client, {
      timeoutMs: input.healthTimeoutMs ?? 15_000,
      pollMs: input.healthPollMs ?? 500,
    });
    const path = unwrap(await client.path.get());
    const directory = path.directory?.trim();
    return directory && directory.length > 0 ? directory : null;
  } catch {
    return null;
  }
}

async function syncProjectDirectoryFromServer(input: {
  baseUrl: string;
  username?: string;
  password?: string;
  healthTimeoutMs?: number;
  healthPollMs?: number;
}): Promise<boolean> {
  const directory = await fetchDefaultProjectDirectory(input);
  if (!directory) return false;

  const project = useProjectStore.getState();
  if (project.currentDirectory !== directory) {
    project.setDirectory(directory);
  }
  return true;
}

function clearProjectDirectory() {
  const project = useProjectStore.getState();
  if (project.currentDirectory) {
    project.setDirectory(null);
  }
}

/**
 * Restore provider credentials and custom provider configs from the local
 * SQLite store into a freshly started OpenCode server instance.
 */
async function restoreProviderCredentials(
  input: ServerConnectionInput & { profileId: string },
): Promise<boolean> {
  try {
    const [credentials, customProviders] = await Promise.all([
      listCredentials(input.profileId),
      listCustomProviders(input.profileId),
    ]);

    if (credentials.length === 0 && customProviders.length === 0) {
      return false;
    }

    const client = buildClient(input);

    // Restore custom provider configurations to the global config so they survive dispose()
    for (const cp of customProviders) {
      try {
        const providerConfig = JSON.parse(cp.providerConfig);
        await client.global.config.update({
          config: { provider: { [cp.providerId]: providerConfig } },
        });
      } catch (err) {
        console.warn(
          `[restoreProviderCredentials] Failed to restore custom provider "${cp.providerId}":`,
          err,
        );
      }
    }

    // Restore auth credentials
    for (const cred of credentials) {
      try {
        const auth = JSON.parse(cred.authData);
        await client.auth.set({ providerID: cred.providerId, auth });
      } catch (err) {
        console.warn(
          `[restoreProviderCredentials] Failed to restore credential for "${cred.providerId}":`,
          err,
        );
      }
    }

    // Single dispose to reinitialise with all restored state
    await client.global.dispose();

    console.info(
      `[restoreProviderCredentials] Restored ${credentials.length} credential(s) and ${customProviders.length} custom provider(s).`,
    );
    return true;
  } catch (err) {
    console.error('[restoreProviderCredentials] Restore failed:', err);
    return false;
  }
}

// ---------------------------------------------------------------------------
// Hooks
// ---------------------------------------------------------------------------

/**
 * Check if Docker is available on the host (local profile only).
 */
export function useDockerCheck() {
  const { scope, isLocal } = useActiveConnection();

  return useQuery({
    queryKey: SANDBOX_KEYS.docker(scope),
    queryFn: () => invoke<DockerInfo>('check_docker'),
    staleTime: 30_000,
    retry: false,
    enabled: isLocal,
  });
}

/**
 * Poll local sandbox container status.
 * Remote profiles do not call Rust docker status commands.
 */
export function useSandboxStatus() {
  const { scope, isLocal, endpoints, secrets } = useActiveConnection();
  const isMutating = useSandboxStore((s) => s.isMutating);
  const syncInFlightRef = useRef(false);

  const query = useQuery({
    queryKey: SANDBOX_KEYS.status(scope),
    queryFn: async () => invoke<SandboxStatus>('get_sandbox_status'),
    refetchInterval: 5_000,
    enabled: isLocal && !isMutating,
  });
  const isContainerRunning = query.data?.running;

  // Sync local docker state into the shared UI status.
  useEffect(() => {
    if (!isLocal || isMutating || isContainerRunning === undefined) return;
    const serverStatus: SandboxStatusValue = isContainerRunning ? 'running' : 'idle';
    const currentStatus = useSandboxStore.getState().status;
    if (serverStatus !== currentStatus) {
      useSandboxStore.getState().setStatus(serverStatus);
    }
  }, [isLocal, isMutating, isContainerRunning]);

  // Keep project directory in sync with local sandbox lifecycle transitions.
  useEffect(() => {
    if (!isLocal || isMutating || isContainerRunning === undefined) return;

    if (!isContainerRunning) {
      clearProjectDirectory();
      return;
    }

    const project = useProjectStore.getState();
    if (project.currentDirectory) return;
    if (syncInFlightRef.current) return;

    syncInFlightRef.current = true;
    void syncProjectDirectoryFromServer({
      baseUrl: endpoints.opencodeBaseUrl,
      username: secrets.opencodeUsername,
      password: secrets.opencodePassword,
      healthTimeoutMs: 2_000,
      healthPollMs: 300,
    }).finally(() => {
      syncInFlightRef.current = false;
    });
  }, [
    isLocal,
    isMutating,
    isContainerRunning,
    query.dataUpdatedAt,
    endpoints.opencodeBaseUrl,
    secrets.opencodeUsername,
    secrets.opencodePassword,
  ]);

  return query;
}

/**
 * Computed sandbox state for UI display.
 */
export function useSandboxState(): SandboxStatusValue {
  const { data } = useSandboxStatus();
  const status = useSandboxStore((s) => s.status);
  const isMutating = useSandboxStore((s) => s.isMutating);
  const { isRemote } = useActiveConnection();

  if (isRemote) {
    return status;
  }

  if (isMutating) {
    return status;
  }

  if (!data) return 'checking';
  return data.running ? 'running' : 'idle';
}

/**
 * Connect to a remote OpenCode server.
 */
export function useConnectRemote() {
  const qc = useQueryClient();
  const { scope, isRemote, endpoints, secrets } = useActiveConnection();

  return useMutation({
    onMutate: async () => {
      useSandboxStore.getState().setStatus('connecting');
      useSandboxStore.getState().setMutating(true);
      await qc.cancelQueries({ queryKey: SANDBOX_KEYS.status(scope) });
    },
    mutationFn: async () => {
      if (!isRemote) {
        throw new Error('Current profile is not a remote connection');
      }
      await verifyRemoteConnection({
        baseUrl: endpoints.opencodeBaseUrl,
        username: secrets.opencodeUsername,
        password: secrets.opencodePassword,
      });
      return 'connected';
    },
    onSuccess: async () => {
      useSandboxStore.getState().setMutating(false);
      await syncProjectDirectoryFromServer({
        baseUrl: endpoints.opencodeBaseUrl,
        username: secrets.opencodeUsername,
        password: secrets.opencodePassword,
      });
      useSandboxStore.getState().setStatus('running');
      void qc.invalidateQueries({ queryKey: SANDBOX_KEYS.status(scope) });
      void qc.invalidateQueries({ queryKey: ['project', scope] });
    },
    onError: (error) => {
      useSandboxStore.getState().setMutating(false);
      const message =
        error instanceof Error ? error.message : 'Failed to connect remote';
      useSandboxStore.getState().setError(message);
    },
  });
}

/**
 * Disconnect from a remote profile without mutating remote services.
 */
export function useDisconnectRemote() {
  const qc = useQueryClient();
  const { scope } = useActiveConnection();

  return useMutation({
    onMutate: async () => {
      useSandboxStore.getState().setMutating(true);
      await qc.cancelQueries({ queryKey: SANDBOX_KEYS.status(scope) });
    },
    mutationFn: async () => 'disconnected',
    onSuccess: () => {
      useSandboxStore.getState().setMutating(false);
      useSandboxStore.getState().setStatus('idle');
      void qc.invalidateQueries({ queryKey: SANDBOX_KEYS.status(scope) });
      void qc.invalidateQueries({ queryKey: ['project', scope] });
      clearProjectDirectory();
    },
    onError: (error) => {
      useSandboxStore.getState().setMutating(false);
      const message =
        error instanceof Error ? error.message : 'Failed to disconnect remote';
      useSandboxStore.getState().setError(message);
    },
  });
}

/**
 * Start local sandbox or connect remote profile.
 */
export function useStartSandbox() {
  const qc = useQueryClient();
  const { profile, scope, isRemote, endpoints, secrets } =
    useActiveConnection();

  return useMutation({
    onMutate: async () => {
      useSandboxStore.getState().setStatus(isRemote ? 'connecting' : 'pulling');
      useSandboxStore.getState().setMutating(true);
      await qc.cancelQueries({ queryKey: SANDBOX_KEYS.status(scope) });
    },
    mutationFn: async (config?: SandboxConfig) => {
      if (isRemote) {
        await verifyRemoteConnection({
          baseUrl: endpoints.opencodeBaseUrl,
          username: secrets.opencodeUsername,
          password: secrets.opencodePassword,
        });
        return 'connected';
      }

      return invoke<string>('start_sandbox', {
        config: config ?? null,
      });
    },
    onSuccess: async () => {
      useSandboxStore.getState().setMutating(false);
      if (isRemote) {
        await syncProjectDirectoryFromServer({
          baseUrl: endpoints.opencodeBaseUrl,
          username: secrets.opencodeUsername,
          password: secrets.opencodePassword,
        });
        useSandboxStore.getState().setStatus('running');
      } else {
        await syncProjectDirectoryFromServer({
          baseUrl: endpoints.opencodeBaseUrl,
          username: secrets.opencodeUsername,
          password: secrets.opencodePassword,
          healthTimeoutMs: 20_000,
          healthPollMs: 500,
        });

        // Restore provider credentials from local SQLite into the fresh sandbox
        await restoreProviderCredentials({
          profileId: profile.id,
          baseUrl: endpoints.opencodeBaseUrl,
          username: secrets.opencodeUsername,
          password: secrets.opencodePassword,
        });
      }
      void qc.invalidateQueries({ queryKey: SANDBOX_KEYS.status(scope) });
      void qc.invalidateQueries({ queryKey: ['project', scope] });
      void qc.invalidateQueries({ queryKey: CONFIG_KEYS.all(scope) });
    },
    onError: (error) => {
      useSandboxStore.getState().setMutating(false);
      const message =
        error instanceof Error ? error.message : 'Failed to start sandbox';
      useSandboxStore.getState().setError(message);
    },
  });
}

/**
 * Stop local sandbox or disconnect remote profile.
 */
export function useStopSandbox() {
  const qc = useQueryClient();
  const { scope, isRemote } = useActiveConnection();

  return useMutation({
    onMutate: async () => {
      useSandboxStore.getState().setStatus(isRemote ? 'stopping' : 'stopping');
      useSandboxStore.getState().setMutating(true);
      await qc.cancelQueries({ queryKey: SANDBOX_KEYS.status(scope) });
    },
    mutationFn: async () => {
      if (isRemote) {
        return 'disconnected';
      }
      return invoke<string>('stop_sandbox');
    },
    onSuccess: () => {
      useSandboxStore.getState().setMutating(false);
      if (isRemote) {
        useSandboxStore.getState().setStatus('idle');
      }
      void qc.invalidateQueries({ queryKey: SANDBOX_KEYS.status(scope) });
      void qc.invalidateQueries({ queryKey: ['project', scope] });
      clearProjectDirectory();
    },
    onError: (error) => {
      useSandboxStore.getState().setMutating(false);
      const message =
        error instanceof Error ? error.message : 'Failed to stop sandbox';
      useSandboxStore.getState().setError(message);
    },
  });
}
