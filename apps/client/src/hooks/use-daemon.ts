/**
 * @license
 * Copyright 2026 cofy-x
 * SPDX-License-Identifier: Apache-2.0
 *
 * React Query hooks for interacting with the daemon service inside the
 * sandbox container via the typed helpers in `lib/daemon.ts`.
 */

import { useQuery } from '@tanstack/react-query';

import {
  getVersion,
  getComputerUseSystemStatus,
  type ComputerUseStatusResponse,
} from '@/lib/daemon';
import { useSandboxStore } from '@/stores/sandbox-store';
import { useActiveConnection } from '@/hooks/use-connection';

// ---------------------------------------------------------------------------
// Query keys
// ---------------------------------------------------------------------------

export const DAEMON_KEYS = {
  version: ['daemon', 'version'] as const,
  computerUseStatus: ['daemon', 'computeruse', 'status'] as const,
};

// ---------------------------------------------------------------------------
// Hooks
// ---------------------------------------------------------------------------

/**
 * Poll the daemon's /version endpoint to determine if the daemon process
 * is healthy and accepting requests.
 */
export function useDaemonHealth() {
  const sandboxStatus = useSandboxStore((s) => s.status);
  const { scope, endpoints, secrets } = useActiveConnection();

  return useQuery({
    queryKey: [...DAEMON_KEYS.version, scope] as const,
    queryFn: () =>
      getVersion({
        baseUrl: endpoints.daemonBaseUrl,
        token: secrets.daemonToken,
      }),
    enabled: sandboxStatus === 'running',
    refetchInterval: 15_000,
    retry: 2,
  });
}

/**
 * Fetch the current computer-use system status (`"active" | "inactive"`).
 * Only enabled while the sandbox is running.
 */
export function useComputerUseStatus() {
  const sandboxStatus = useSandboxStore((s) => s.status);
  const { scope, endpoints, secrets } = useActiveConnection();

  return useQuery<ComputerUseStatusResponse>({
    queryKey: [...DAEMON_KEYS.computerUseStatus, scope] as const,
    queryFn: () =>
      getComputerUseSystemStatus({
        baseUrl: endpoints.daemonBaseUrl,
        token: secrets.daemonToken,
      }),
    enabled: sandboxStatus === 'running',
    refetchInterval: 10_000,
    retry: false,
  });
}
