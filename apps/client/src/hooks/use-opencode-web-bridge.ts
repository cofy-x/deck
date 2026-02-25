/**
 * @license
 * Copyright 2026 cofy-x
 * SPDX-License-Identifier: Apache-2.0
 */
import { useEffect, useMemo, useState } from 'react';
import { listen } from '@tauri-apps/api/event';

import { useActiveConnection } from '@/hooks/use-connection';
import {
  OPENCODE_BRIDGE_EVENT_AUTH_FAILURE,
  startOpencodeWebBridge,
  stopOpencodeWebBridge,
  type OpencodeWebBridgeInfo,
} from '@/lib/opencode-web-bridge';
import { UNAUTHORIZED_MESSAGE } from '@/lib/opencode';
import { isTauriRuntime } from '@/lib/utils';
import { useProjectStore } from '@/stores/project-store';
import { useSandboxStore } from '@/stores/sandbox-store';

type BridgeLifecycleStatus = 'idle' | 'starting' | 'running' | 'error';

interface BridgeState {
  status: BridgeLifecycleStatus;
  info: OpencodeWebBridgeInfo | null;
  errorMessage: string | null;
}

interface BridgeAuthFailurePayload {
  profileId?: string;
  status?: number;
}

const INITIAL_STATE: BridgeState = {
  status: 'idle',
  info: null,
  errorMessage: null,
};

function toErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  return 'Failed to start OpenCode web bridge';
}

export interface UseOpencodeWebBridgeResult {
  requiresBridge: boolean;
  status: BridgeLifecycleStatus;
  errorMessage: string | null;
  iframeUrl: string | null;
  iframeKey: string;
}

export function useOpencodeWebBridge(): UseOpencodeWebBridgeResult {
  const { profile, endpoints, secrets, isRemote } = useActiveConnection();
  const currentDirectory = useProjectStore((s) => s.currentDirectory);
  const sandboxStatus = useSandboxStore((s) => s.status);
  const [state, setState] = useState<BridgeState>(INITIAL_STATE);

  const hasRemoteBasicAuth =
    isRemote && !!secrets.opencodeUsername && !!secrets.opencodePassword;

  const requiresBridge =
    isTauriRuntime() &&
    hasRemoteBasicAuth &&
    sandboxStatus === 'running' &&
    profile.type === 'remote';

  useEffect(() => {
    let cancelled = false;

    const syncBridge = async () => {
      if (!requiresBridge) {
        await stopOpencodeWebBridge().catch(() => {
          // Ignore stop errors on teardown.
        });
        if (!cancelled) {
          setState(INITIAL_STATE);
        }
        return;
      }

      setState((current) => ({
        ...current,
        status: 'starting',
        errorMessage: null,
      }));

      try {
        const info = await startOpencodeWebBridge({
          profileId: profile.id,
          upstreamBaseUrl: endpoints.opencodeBaseUrl,
          username: secrets.opencodeUsername ?? '',
          password: secrets.opencodePassword ?? '',
          directory: currentDirectory ?? undefined,
        });

        if (cancelled) return;

        setState({
          status: 'running',
          info,
          errorMessage: null,
        });
      } catch (error) {
        if (cancelled) return;

        setState({
          status: 'error',
          info: null,
          errorMessage: toErrorMessage(error),
        });
      }
    };

    void syncBridge();

    return () => {
      cancelled = true;
    };
  }, [
    requiresBridge,
    profile.id,
    endpoints.opencodeBaseUrl,
    secrets.opencodeUsername,
    secrets.opencodePassword,
    currentDirectory,
  ]);

  useEffect(
    () => () => {
      void stopOpencodeWebBridge().catch(() => {
        // Ignore teardown errors during app shutdown.
      });
    },
    [],
  );

  useEffect(() => {
    if (!isTauriRuntime()) return;

    let active = true;
    let dispose: (() => void) | null = null;

    void listen<BridgeAuthFailurePayload>(
      OPENCODE_BRIDGE_EVENT_AUTH_FAILURE,
      (event) => {
        if (!active) return;
        if (event.payload?.profileId !== profile.id) return;

        const sandbox = useSandboxStore.getState();
        sandbox.setMutating(false);
        sandbox.setError(UNAUTHORIZED_MESSAGE);

        setState({
          status: 'error',
          info: null,
          errorMessage: UNAUTHORIZED_MESSAGE,
        });
      },
    )
      .then((unlisten) => {
        if (!active) {
          unlisten();
          return;
        }
        dispose = unlisten;
      })
      .catch(() => {
        // Ignore event registration errors in non-desktop environments.
      });

    return () => {
      active = false;
      dispose?.();
    };
  }, [profile.id]);

  const iframeUrl = useMemo(() => {
    if (requiresBridge) {
      return state.info?.iframeBaseUrl ?? null;
    }
    return endpoints.opencodeBaseUrl;
  }, [requiresBridge, state.info?.iframeBaseUrl, endpoints.opencodeBaseUrl]);

  const iframeKey = useMemo(() => {
    if (!requiresBridge) {
      return `direct|${profile.id}|${endpoints.opencodeBaseUrl}`;
    }
    return `bridge|${profile.id}|${state.info?.port ?? 'none'}|${currentDirectory ?? ''}`;
  }, [
    requiresBridge,
    profile.id,
    endpoints.opencodeBaseUrl,
    state.info?.port,
    currentDirectory,
  ]);

  return {
    requiresBridge,
    status: state.status,
    errorMessage: state.errorMessage,
    iframeUrl,
    iframeKey,
  };
}
