/**
 * @license
 * Copyright 2026 cofy-x
 * SPDX-License-Identifier: Apache-2.0
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { invoke } from '@tauri-apps/api/core';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';
import { toast } from 'sonner';

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
  type SandboxStartupPhase,
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
  resolved_path: string | null;
}

export interface SandboxStorageInfo {
  root_dir: string;
  exists: boolean;
  size_bytes: number;
  available: boolean;
  legacy_container_detected: boolean;
}

interface SandboxConfig {
  image?: string;
  container_name?: string;
  persistence?: {
    enabled?: boolean;
    root?: string;
  };
}

interface SandboxStartResult {
  container_id: string;
  created_fresh: boolean;
}

interface PullProgress {
  stage: string;
  message: string;
  percent: number;
  layers_done: number;
  layers_total: number;
}

// ---------------------------------------------------------------------------
// Query keys
// ---------------------------------------------------------------------------

export const SANDBOX_KEYS = {
  status: (scope: string) => ['sandbox', 'status', scope] as const,
  docker: (scope: string) => ['sandbox', 'docker', scope] as const,
  storage: (scope: string) => ['sandbox', 'storage', scope] as const,
};

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

interface ServerConnectionInput {
  baseUrl: string;
  username?: string;
  password?: string;
}

interface ProjectSyncOptions {
  healthTimeoutMs?: number;
  healthPollMs?: number;
  pathTimeoutMs?: number;
  skipHealthCheck?: boolean;
  source?: string;
  scopeKey?: string;
  markDetectingProject?: boolean;
  force?: boolean;
}

const projectDirectorySyncInFlight = new Map<string, Promise<boolean>>();
const projectSyncReuseLogAtMs = new Map<string, number>();
const PROJECT_SYNC_REUSE_LOG_THROTTLE_MS = 10_000;
const LOCAL_PROJECT_DETECT_RETRY_COOLDOWN_MS = 15_000;
const localProjectDetectLastRequestedAtMs = new Map<string, number>();

interface StartupPhaseEvent {
  phase: Exclude<SandboxStartupPhase, 'none'> | 'opencode_healthy';
}

interface SandboxProjectDetectingEvent {
  trigger: string;
}

interface SandboxProjectDetectedEvent {
  trigger: string;
  directory: string;
  elapsed_ms: number;
}

interface SandboxProjectDetectTimeoutEvent {
  trigger: string;
  elapsed_ms: number;
  reason: string;
}

function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  timeoutMessage: string,
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = window.setTimeout(() => reject(new Error(timeoutMessage)), timeoutMs);
    promise
      .then((value) => {
        window.clearTimeout(timer);
        resolve(value);
      })
      .catch((error) => {
        window.clearTimeout(timer);
        reject(error);
      });
  });
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
  input: ServerConnectionInput & ProjectSyncOptions,
): Promise<string | null> {
  const source = input.source ?? 'unknown';
  const startedAt = Date.now();
  try {
    const client = buildClient(input);
    if (!input.skipHealthCheck) {
      console.info('[project-sync] waiting for health', {
        source,
        timeoutMs: input.healthTimeoutMs ?? 15_000,
        pollMs: input.healthPollMs ?? 500,
      });
      await waitForHealthy(client, {
        timeoutMs: input.healthTimeoutMs ?? 15_000,
        pollMs: input.healthPollMs ?? 500,
      });
    }
    const pathTimeoutMs = input.pathTimeoutMs ?? 30_000;
    const beforePath = Date.now();
    const path = unwrap(
      await withTimeout(
        client.path.get(),
        pathTimeoutMs,
        `OpenCode /path timed out after ${pathTimeoutMs}ms`,
      ),
    );
    const directory = path.directory?.trim();
    const pathElapsedMs = Date.now() - beforePath;
    const totalElapsedMs = Date.now() - startedAt;
    console.info('[project-sync] fetched default directory', {
      source,
      directory: directory ?? null,
      pathElapsedMs,
      totalElapsedMs,
    });
    return directory && directory.length > 0 ? directory : null;
  } catch (error) {
    console.warn('[project-sync] failed to fetch default directory', {
      source,
      totalElapsedMs: Date.now() - startedAt,
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

async function syncProjectDirectoryFromServer(
  input: ServerConnectionInput & ProjectSyncOptions,
): Promise<boolean> {
  const scopeKey = input.scopeKey ?? input.baseUrl;
  if (input.markDetectingProject) {
    useSandboxStore.getState().setStartupPhase('detecting_project');
  }

  if (!input.force) {
    const inFlight = projectDirectorySyncInFlight.get(scopeKey);
    if (inFlight) {
      const now = Date.now();
      const lastLogAt = projectSyncReuseLogAtMs.get(scopeKey) ?? 0;
      if (now - lastLogAt >= PROJECT_SYNC_REUSE_LOG_THROTTLE_MS) {
        projectSyncReuseLogAtMs.set(scopeKey, now);
        console.info('[project-sync] reusing in-flight sync request', {
          source: input.source ?? 'unknown',
          scopeKey,
        });
      }
      return inFlight;
    }
  }

  const source = input.source ?? 'unknown';
  const request = (async (): Promise<boolean> => {
    const startedAt = Date.now();
    const directory = await fetchDefaultProjectDirectory(input);
    if (!directory) return false;

    const project = useProjectStore.getState();
    if (project.currentDirectory !== directory) {
      project.setDirectory(directory);
    }
    useSandboxStore.getState().clearStartupPhase();
    console.info('[project-sync] directory synced', {
      source,
      directory,
      scopeKey,
      totalElapsedMs: Date.now() - startedAt,
    });
    return true;
  })().finally(() => {
    projectDirectorySyncInFlight.delete(scopeKey);
    projectSyncReuseLogAtMs.delete(scopeKey);
  });

  projectDirectorySyncInFlight.set(scopeKey, request);
  return request;
}

async function requestLocalProjectDetection(
  input: {
    scopeKey: string;
    source: string;
    force?: boolean;
  },
): Promise<boolean> {
  const now = Date.now();
  const lastRequestedAtMs =
    localProjectDetectLastRequestedAtMs.get(input.scopeKey) ?? 0;
  if (
    !input.force &&
    now - lastRequestedAtMs < LOCAL_PROJECT_DETECT_RETRY_COOLDOWN_MS
  ) {
    return false;
  }

  localProjectDetectLastRequestedAtMs.set(input.scopeKey, now);
  try {
    await invoke<void>('retry_local_project_detection');
    console.info('[project-sync] requested local project detection', {
      source: input.source,
      scopeKey: input.scopeKey,
      force: !!input.force,
    });
    return true;
  } catch (error) {
    localProjectDetectLastRequestedAtMs.delete(input.scopeKey);
    console.warn('[project-sync] failed to request local project detection', {
      source: input.source,
      scopeKey: input.scopeKey,
      error: error instanceof Error ? error.message : String(error),
    });
    return false;
  }
}

function clearProjectDirectory() {
  const project = useProjectStore.getState();
  if (project.currentDirectory) {
    project.setDirectory(null);
  }
  localProjectDetectLastRequestedAtMs.clear();
  useSandboxStore.getState().clearStartupPhase();
}

/**
 * Restore provider credentials and custom provider configs from the local
 * SQLite store into a freshly started OpenCode server instance.
 */
async function restoreProviderCredentials(
  input: ServerConnectionInput & { profileId: string },
): Promise<boolean> {
  const startedAt = Date.now();
  try {
    const [credentials, customProviders] = await Promise.all([
      listCredentials(input.profileId),
      listCustomProviders(input.profileId),
    ]);

    if (credentials.length === 0 && customProviders.length === 0) {
      return false;
    }

    const client = buildClient(input);
    let restoredCustomProviderCount = 0;
    let restoredCredentialCount = 0;

    // Restore custom provider configurations to the global config so they survive dispose()
    for (const cp of customProviders) {
      try {
        const providerConfig = JSON.parse(cp.providerConfig);
        await client.global.config.update({
          config: { provider: { [cp.providerId]: providerConfig } },
        });
        restoredCustomProviderCount += 1;
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
        restoredCredentialCount += 1;
      } catch (err) {
        console.warn(
          `[restoreProviderCredentials] Failed to restore credential for "${cred.providerId}":`,
          err,
        );
      }
    }

    // Dispose is required when provider config is patched.
    // For auth-only restore, skipping dispose avoids a startup-wide warmup stall.
    const shouldDispose = restoredCustomProviderCount > 0;
    let disposeElapsedMs = 0;
    if (shouldDispose) {
      const disposeStartedAt = Date.now();
      await client.global.dispose();
      disposeElapsedMs = Date.now() - disposeStartedAt;
    }

    console.info('[restoreProviderCredentials] Restore completed', {
      profileId: input.profileId,
      restoredCredentialCount,
      restoredCustomProviderCount,
      shouldDispose,
      disposeElapsedMs,
      totalElapsedMs: Date.now() - startedAt,
    });
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
 * Read local sandbox persistent storage information (local profile only).
 */
export function useSandboxStorageInfo() {
  const { scope, isLocal } = useActiveConnection();

  return useQuery({
    queryKey: SANDBOX_KEYS.storage(scope),
    queryFn: () =>
      invoke<SandboxStorageInfo>('get_sandbox_storage_info', {
        config: null,
      }),
    staleTime: 10_000,
    retry: false,
    enabled: isLocal,
  });
}

/**
 * Poll local sandbox container status.
 * Remote profiles do not call Rust docker status commands.
 */
export function useSandboxStatus() {
  const { scope, isLocal } = useActiveConnection();
  const isMutating = useSandboxStore((s) => s.isMutating);

  const query = useQuery({
    queryKey: SANDBOX_KEYS.status(scope),
    queryFn: async () => invoke<SandboxStatus>('get_sandbox_status'),
    refetchInterval: 5_000,
    enabled: isLocal && !isMutating,
  });
  const isContainerRunning = query.data?.running;

  // Sync local docker state into the shared UI status.
  // Preserve error state — only a new user action (start/stop) should clear it.
  useEffect(() => {
    if (!isLocal || isMutating) return;
    const currentStatus = useSandboxStore.getState().status;

    if (isContainerRunning === undefined) {
      // Only show "checking" during true idle/initial polling.
      // Do not override "running"/"starting" etc. while a fresh status value
      // is still loading, to avoid transient status flicker.
      if (currentStatus === 'idle') {
        useSandboxStore.getState().setStatus('checking');
      }
      return;
    }

    if (currentStatus === 'error') return;
    const serverStatus: SandboxStatusValue = isContainerRunning ? 'running' : 'idle';
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
    if (project.currentDirectory) {
      useSandboxStore.getState().clearStartupPhase();
      localProjectDetectLastRequestedAtMs.delete(scope);
      return;
    }

    useSandboxStore.getState().setStartupPhase('detecting_project');
    void requestLocalProjectDetection({
      scopeKey: scope,
      source: 'status-poll-running',
    });
  }, [isLocal, isMutating, isContainerRunning, query.dataUpdatedAt, scope]);

  return query;
}

/**
 * Computed sandbox state for UI display.
 */
export function useSandboxState(): SandboxStatusValue {
  return useSandboxStore((s) => s.status);
}

export function useSandboxStartupProgress() {
  const phase = useSandboxStore((s) => s.startupPhase);
  const phaseSinceMs = useSandboxStore((s) => s.startupPhaseSinceMs);
  const [nowMs, setNowMs] = useState(() => Date.now());

  useEffect(() => {
    if (phase === 'none' || !phaseSinceMs) return;
    const timer = window.setInterval(() => {
      setNowMs(Date.now());
    }, 1_000);
    return () => window.clearInterval(timer);
  }, [phase, phaseSinceMs]);

  const elapsedMs =
    phase !== 'none' && phaseSinceMs ? Math.max(0, nowMs - phaseSinceMs) : 0;

  return { phase, elapsedMs };
}

export function useSandboxProjectDetectionEvents() {
  const qc = useQueryClient();
  const { isLocal, scope } = useActiveConnection();

  useEffect(() => {
    if (!isLocal) return;

    let disposed = false;
    let unlistenDetecting: UnlistenFn | null = null;
    let unlistenDetected: UnlistenFn | null = null;
    let unlistenTimeout: UnlistenFn | null = null;

    const attachListeners = async () => {
      try {
        const unlisten = await listen<SandboxProjectDetectingEvent>(
          'sandbox-project-detecting',
          (event) => {
            localProjectDetectLastRequestedAtMs.set(scope, Date.now());
            useSandboxStore.getState().setStartupPhase('detecting_project');
            console.info('[project-sync] local project detection started', {
              scopeKey: scope,
              trigger: event.payload.trigger,
            });
          },
        );
        if (disposed) {
          unlisten();
        } else {
          unlistenDetecting = unlisten;
        }
      } catch (error) {
        console.warn('[project-sync] failed to listen project detecting event', {
          scopeKey: scope,
          error: error instanceof Error ? error.message : String(error),
        });
      }

      try {
        const unlisten = await listen<SandboxProjectDetectedEvent>(
          'sandbox-project-detected',
          (event) => {
            const directory = event.payload.directory?.trim();
            if (!directory) return;

            const project = useProjectStore.getState();
            if (project.currentDirectory !== directory) {
              project.setDirectory(directory);
            }

            localProjectDetectLastRequestedAtMs.delete(scope);
            useSandboxStore.getState().clearStartupPhase();
            void qc.invalidateQueries({ queryKey: ['project', scope] });
            console.info('[project-sync] local directory synced', {
              scopeKey: scope,
              trigger: event.payload.trigger,
              directory,
              elapsedMs: event.payload.elapsed_ms,
            });
          },
        );
        if (disposed) {
          unlisten();
        } else {
          unlistenDetected = unlisten;
        }
      } catch (error) {
        console.warn('[project-sync] failed to listen project detected event', {
          scopeKey: scope,
          error: error instanceof Error ? error.message : String(error),
        });
      }

      try {
        const unlisten = await listen<SandboxProjectDetectTimeoutEvent>(
          'sandbox-project-detect-timeout',
          (event) => {
            console.warn('[project-sync] local project detection timed out', {
              scopeKey: scope,
              trigger: event.payload.trigger,
              elapsedMs: event.payload.elapsed_ms,
              reason: event.payload.reason,
            });
          },
        );
        if (disposed) {
          unlisten();
        } else {
          unlistenTimeout = unlisten;
        }
      } catch (error) {
        console.warn('[project-sync] failed to listen project timeout event', {
          scopeKey: scope,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    };

    void attachListeners();

    return () => {
      disposed = true;
      localProjectDetectLastRequestedAtMs.delete(scope);
      if (unlistenDetecting) {
        unlistenDetecting();
        unlistenDetecting = null;
      }
      if (unlistenDetected) {
        unlistenDetected();
        unlistenDetected = null;
      }
      if (unlistenTimeout) {
        unlistenTimeout();
        unlistenTimeout = null;
      }
    };
  }, [isLocal, qc, scope]);
}

/**
 * Connect to a remote OpenCode server.
 */
export function useConnectRemote() {
  const qc = useQueryClient();
  const { scope, isRemote, endpoints, secrets } = useActiveConnection();

  return useMutation({
    onMutate: async () => {
      const store = useSandboxStore.getState();
      store.setStatus('connecting');
      store.setMutating(true);
      store.clearStartupPhase();
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
      const store = useSandboxStore.getState();
      store.setStatus('running');
      store.setMutating(false);
      void syncProjectDirectoryFromServer({
        baseUrl: endpoints.opencodeBaseUrl,
        username: secrets.opencodeUsername,
        password: secrets.opencodePassword,
        skipHealthCheck: true,
        source: 'remote-connect-success',
        scopeKey: scope,
      });
      void qc.invalidateQueries({ queryKey: SANDBOX_KEYS.status(scope) });
      void qc.invalidateQueries({ queryKey: ['project', scope] });
    },
    onError: (error) => {
      const store = useSandboxStore.getState();
      store.setMutating(false);
      store.clearStartupPhase();
      const message =
        error instanceof Error ? error.message : 'Failed to connect remote';
      store.setError(message);
      toast.error('Remote connection failed', { description: message });
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
      const store = useSandboxStore.getState();
      store.setMutating(false);
      store.setStatus('idle');
      store.clearStartupPhase();
      void qc.invalidateQueries({ queryKey: SANDBOX_KEYS.status(scope) });
      void qc.invalidateQueries({ queryKey: ['project', scope] });
      clearProjectDirectory();
    },
    onError: (error) => {
      const store = useSandboxStore.getState();
      store.setMutating(false);
      store.clearStartupPhase();
      const message =
        error instanceof Error ? error.message : 'Failed to disconnect remote';
      store.setError(message);
      toast.error('Remote disconnect failed', { description: message });
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
  const unlistenRef = useRef<UnlistenFn | null>(null);
  const startupPhaseUnlistenRef = useRef<UnlistenFn | null>(null);

  return useMutation({
    onMutate: async () => {
      const store = useSandboxStore.getState();
      store.setStatus(isRemote ? 'connecting' : 'starting');
      store.setMutating(true);
      store.clearPullProgress();
      store.clearStartupPhase();
      if (!isRemote) {
        store.setStartupPhase('starting_container');
      }
      await qc.cancelQueries({ queryKey: SANDBOX_KEYS.status(scope) });

      if (!isRemote) {
        try {
          unlistenRef.current = await listen<PullProgress>(
            'sandbox-pull-progress',
            (event) => {
              const { percent, message, layers_done, layers_total } = event.payload;
              const store = useSandboxStore.getState();
              if (store.status !== 'pulling') {
                store.setStatus('pulling');
              }
              store.setPullProgress(percent, message, layers_done, layers_total);
              store.updatePullLog(message);
            },
          );
        } catch (err) {
          console.warn('[useStartSandbox] Failed to listen for pull progress:', err);
        }

        try {
          startupPhaseUnlistenRef.current = await listen<StartupPhaseEvent>(
            'sandbox-startup-phase',
            (event) => {
              const nextPhase = event.payload.phase;
              if (nextPhase === 'opencode_healthy') return;
              useSandboxStore.getState().setStartupPhase(nextPhase);
            },
          );
        } catch (err) {
          console.warn(
            '[useStartSandbox] Failed to listen for sandbox startup phase:',
            err,
          );
        }
      }
    },
    mutationFn: async (config?: SandboxConfig) => {
      if (isRemote) {
        await verifyRemoteConnection({
          baseUrl: endpoints.opencodeBaseUrl,
          username: secrets.opencodeUsername,
          password: secrets.opencodePassword,
        });
        return { mode: 'remote' as const };
      }

      const startResult = await invoke<SandboxStartResult>('start_sandbox', {
        config: config ?? null,
      });
      return { mode: 'local' as const, startResult };
    },
    onSuccess: async (result) => {
      const store = useSandboxStore.getState();
      if (result.mode === 'remote') {
        store.clearStartupPhase();
        store.setStatus('running');
        store.setMutating(false);
        void syncProjectDirectoryFromServer({
          baseUrl: endpoints.opencodeBaseUrl,
          username: secrets.opencodeUsername,
          password: secrets.opencodePassword,
          skipHealthCheck: true,
          source: 'remote-start-success',
          scopeKey: scope,
        });
      } else {
        store.setStatus('starting');

        if (result.startResult.created_fresh) {
          // Restore provider credentials only for fresh containers.
          // Reused containers already persist OpenCode auth/config state.
          await restoreProviderCredentials({
            profileId: profile.id,
            baseUrl: endpoints.opencodeBaseUrl,
            username: secrets.opencodeUsername,
            password: secrets.opencodePassword,
          });
        } else {
          console.info('[useStartSandbox] skip credential restore for reused container', {
            containerId: result.startResult.container_id,
          });
        }

        store.setStatus('running');
        store.setMutating(false);
      }
      void qc.invalidateQueries({ queryKey: SANDBOX_KEYS.status(scope) });
      void qc.invalidateQueries({ queryKey: SANDBOX_KEYS.storage(scope) });
      void qc.invalidateQueries({ queryKey: ['project', scope] });
      void qc.invalidateQueries({ queryKey: CONFIG_KEYS.all(scope) });
    },
    onError: (error) => {
      const store = useSandboxStore.getState();
      store.setMutating(false);
      store.clearStartupPhase();
      const message =
        error instanceof Error ? error.message : 'Failed to start sandbox';
      store.setError(message);
      toast.error('Sandbox failed to start', { description: message });
    },
    onSettled: () => {
      if (unlistenRef.current) {
        unlistenRef.current();
        unlistenRef.current = null;
      }
      if (startupPhaseUnlistenRef.current) {
        startupPhaseUnlistenRef.current();
        startupPhaseUnlistenRef.current = null;
      }
      useSandboxStore.getState().clearPullProgress();
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
      const store = useSandboxStore.getState();
      store.setStatus(isRemote ? 'stopping' : 'stopping');
      store.setMutating(true);
      store.clearStartupPhase();
      await qc.cancelQueries({ queryKey: SANDBOX_KEYS.status(scope) });
    },
    mutationFn: async () => {
      if (isRemote) {
        return 'disconnected';
      }
      return invoke<string>('stop_sandbox');
    },
    onSuccess: () => {
      const store = useSandboxStore.getState();
      store.setMutating(false);
      store.clearStartupPhase();
      if (isRemote) {
        store.setStatus('idle');
      }
      void qc.invalidateQueries({ queryKey: SANDBOX_KEYS.status(scope) });
      void qc.invalidateQueries({ queryKey: SANDBOX_KEYS.storage(scope) });
      void qc.invalidateQueries({ queryKey: ['project', scope] });
      clearProjectDirectory();
    },
    onError: (error) => {
      const store = useSandboxStore.getState();
      store.setMutating(false);
      store.clearStartupPhase();
      const message =
        error instanceof Error ? error.message : 'Failed to stop sandbox';
      store.setError(message);
      toast.error('Sandbox failed to stop', { description: message });
    },
  });
}

/**
 * Reset local sandbox container and persistent storage.
 * Remote profiles are not mutated.
 */
export function useResetSandboxStorage() {
  const qc = useQueryClient();
  const { scope, isLocal } = useActiveConnection();

  return useMutation({
    mutationFn: async () => {
      if (!isLocal) return 'remote-profile-noop';
      return invoke<string>('reset_sandbox_storage', {
        config: null,
      });
    },
    onSuccess: () => {
      const store = useSandboxStore.getState();
      store.setMutating(false);
      store.clearStartupPhase();
      if (isLocal) {
        store.setStatus('idle');
        clearProjectDirectory();
        void qc.invalidateQueries({ queryKey: SANDBOX_KEYS.status(scope) });
        void qc.invalidateQueries({ queryKey: SANDBOX_KEYS.storage(scope) });
        void qc.invalidateQueries({ queryKey: ['project', scope] });
        void qc.invalidateQueries({ queryKey: CONFIG_KEYS.all(scope) });
      }
    },
    onError: (error) => {
      const store = useSandboxStore.getState();
      store.setMutating(false);
      store.clearStartupPhase();
      const message =
        error instanceof Error
          ? error.message
          : 'Failed to reset sandbox storage';
      store.setError(message);
      toast.error('Sandbox reset failed', { description: message });
    },
    onMutate: () => {
      const store = useSandboxStore.getState();
      store.setMutating(true);
      store.setStatus('stopping');
      store.clearStartupPhase();
    },
  });
}

/**
 * Cancel an in-progress sandbox start (image pull).
 */
export function useCancelSandboxStart() {
  return useCallback(() => {
    void invoke('cancel_sandbox_start');
  }, []);
}
