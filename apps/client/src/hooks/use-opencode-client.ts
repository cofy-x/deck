/**
 * @license
 * Copyright 2026 cofy-x
 * SPDX-License-Identifier: Apache-2.0
 */
import { useRef } from 'react';

import { createClient, UNAUTHORIZED_MESSAGE } from '@/lib/opencode';
import { useSandboxStore } from '@/stores/sandbox-store';
import { useActiveConnection } from '@/hooks/use-connection';

// ---------------------------------------------------------------------------
// OpenCode client type (re-exported for convenience)
// ---------------------------------------------------------------------------

export type OpenCodeClient = ReturnType<typeof createClient>;

function hashSecret(value: string | undefined): string {
  if (!value) return 'none';
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash * 31 + value.charCodeAt(i)) >>> 0;
  }
  return hash.toString(16);
}

// ---------------------------------------------------------------------------
// Shared hook
// ---------------------------------------------------------------------------

/**
 * Returns the OpenCode SDK client when the sandbox is running, or `null`
 * otherwise. The client instance is stable across re-renders while the
 * sandbox stays in the `running` state.
 */
export function useOpenCodeClient(): OpenCodeClient | null {
  const sandboxStatus = useSandboxStore((s) => s.status);
  const { profile, endpoints, secrets, isRemote } = useActiveConnection();
  const clientRef = useRef<OpenCodeClient | null>(null);
  const clientKeyRef = useRef<string>('');

  const authMarker = hashSecret(secrets.opencodePassword);
  const nextKey = `${profile.id}|${endpoints.opencodeBaseUrl}|${secrets.opencodeUsername ?? ''}|${authMarker}`;

  // Only create client when the current connection is ready
  if (sandboxStatus === 'running' && clientKeyRef.current !== nextKey) {
    clientRef.current = createClient({
      baseUrl: endpoints.opencodeBaseUrl,
      auth:
        secrets.opencodeUsername && secrets.opencodePassword
          ? {
              username: secrets.opencodeUsername,
              password: secrets.opencodePassword,
            }
          : undefined,
      onUnauthorized: () => {
        if (!isRemote) return;
        const sandbox = useSandboxStore.getState();
        if (
          sandbox.status === 'error' &&
          sandbox.errorMessage === UNAUTHORIZED_MESSAGE
        ) {
          return;
        }
        sandbox.setMutating(false);
        sandbox.setError(UNAUTHORIZED_MESSAGE);
      },
    });
    clientKeyRef.current = nextKey;
  }

  if (sandboxStatus !== 'running') {
    clientRef.current = null;
    clientKeyRef.current = '';
  }

  return clientRef.current;
}
