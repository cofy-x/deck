/**
 * @license
 * Copyright 2026 cofy-x
 * SPDX-License-Identifier: Apache-2.0
 *
 * Typed daemon HTTP service layer.
 *
 * The auto-generated `DaemonClient` from `@cofy-x/client-daemon` uses the
 * native `fetch` internally. Inside a Tauri webview the origin is
 * `tauri://localhost`, so CORS blocks direct requests to daemon endpoints.
 * To work around this we route all daemon HTTP calls through
 * `@tauri-apps/plugin-http` (which delegates to Rust and bypasses the browser
 * network stack).
 *
 * This module re-exports the relevant *types* from `@cofy-x/client-daemon` and
 * provides a thin, Tauri-aware service object that mirrors the most important
 * `DaemonClient` service methods.
 */

import { fetch as tauriFetch } from '@tauri-apps/plugin-http';

import { LOCAL_DAEMON_BASE_URL, LOCAL_NOVNC_URL } from './constants';
import { isTauriRuntime } from './utils';

// ---------------------------------------------------------------------------
// Re-export types for consumers
// ---------------------------------------------------------------------------

import type {
  ComputerUseStartResponse,
  ComputerUseStatusResponse,
  ComputerUseStopResponse,
  ProcessStatus,
  ProcessStatusResponse,
} from '@cofy-x/client-daemon';

export type {
  ComputerUseStartResponse,
  ComputerUseStatusResponse,
  ComputerUseStopResponse,
  ProcessStatus,
  ProcessStatusResponse,
};

export interface DaemonRequestConfig {
  baseUrl?: string;
  noVncUrl?: string;
  token?: string;
}

// ---------------------------------------------------------------------------
// Internal Tauri-aware fetch helper
// ---------------------------------------------------------------------------

function getFetch(): typeof globalThis.fetch {
  return isTauriRuntime()
    ? (input: RequestInfo | URL, init?: RequestInit) => {
        if (input instanceof Request) {
          return tauriFetch(input);
        }
        return tauriFetch(input, init);
      }
    : globalThis.fetch;
}

function buildDaemonHeaders(config?: DaemonRequestConfig): Headers {
  const headers = new Headers();
  headers.set('Accept', 'application/json');
  if (config?.token) {
    headers.set('X-Deck-Token', config.token);
  }
  return headers;
}

function resolveDaemonBaseUrl(config?: DaemonRequestConfig): string {
  return config?.baseUrl ?? LOCAL_DAEMON_BASE_URL;
}

function resolveNoVncUrl(config?: DaemonRequestConfig): string {
  return config?.noVncUrl ?? LOCAL_NOVNC_URL;
}

async function daemonGet<T>(
  path: string,
  config?: DaemonRequestConfig,
): Promise<T> {
  const url = `${resolveDaemonBaseUrl(config)}${path}`;
  const fetchFn = getFetch();
  const response = await fetchFn(url, {
    method: 'GET',
    headers: buildDaemonHeaders(config),
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) {
    throw new Error(`Daemon GET ${path} failed: ${response.status}`);
  }
  return (await response.json()) as T;
}

async function daemonPost<T>(
  path: string,
  body?: Record<string, unknown>,
  config?: DaemonRequestConfig,
): Promise<T> {
  const url = `${resolveDaemonBaseUrl(config)}${path}`;
  const fetchFn = getFetch();
  const headers = buildDaemonHeaders(config);
  headers.set('Content-Type', 'application/json');
  const response = await fetchFn(url, {
    method: 'POST',
    headers,
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(30_000),
  });
  if (!response.ok) {
    throw new Error(`Daemon POST ${path} failed: ${response.status}`);
  }
  return (await response.json()) as T;
}

// ---------------------------------------------------------------------------
// Typed fetch with lower-level control (for health-check polling)
// ---------------------------------------------------------------------------

/**
 * Raw fetch to daemon — does NOT throw on HTTP errors; returns `null` on
 * failure so callers can implement retry logic without try/catch overhead.
 */
export async function daemonProbe(
  path: string,
  config?: DaemonRequestConfig,
): Promise<boolean> {
  try {
    const url = `${resolveDaemonBaseUrl(config)}${path}`;
    const fetchFn = getFetch();
    const res = await fetchFn(url, {
      method: 'GET',
      headers: buildDaemonHeaders(config),
      signal: AbortSignal.timeout(3_000),
    });
    return res.ok;
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Info service
// ---------------------------------------------------------------------------

export async function getVersion(
  config?: DaemonRequestConfig,
): Promise<Record<string, string>> {
  return daemonGet<Record<string, string>>('/version', config);
}

// ---------------------------------------------------------------------------
// ComputerUse service
// ---------------------------------------------------------------------------

/**
 * GET /computeruse/status — returns `{ status: "active" | "inactive" | ... }`.
 */
export async function getComputerUseSystemStatus(
  config?: DaemonRequestConfig,
): Promise<ComputerUseStatusResponse> {
  return daemonGet<ComputerUseStatusResponse>('/computeruse/status', config);
}

/**
 * POST /computeruse/start — starts Xvfb + Xfce4 + x11vnc + noVNC.
 * This is a relatively slow operation (~5-10 s) so callers should check
 * `getComputerUseSystemStatus()` first.
 */
export async function startComputerUse(
  config?: DaemonRequestConfig,
): Promise<ComputerUseStartResponse> {
  return daemonPost<ComputerUseStartResponse>('/computeruse/start', undefined, config);
}

/**
 * POST /computeruse/stop — stops all computer-use processes.
 */
export async function stopComputerUse(
  config?: DaemonRequestConfig,
): Promise<ComputerUseStatusResponse> {
  return daemonPost<ComputerUseStatusResponse>('/computeruse/stop', undefined, config);
}

// ---------------------------------------------------------------------------
// noVNC readiness probe
// ---------------------------------------------------------------------------

/**
 * Probe whether the noVNC HTTP server on port 6080 is reachable.
 */
export async function probeNoVNC(config?: DaemonRequestConfig): Promise<boolean> {
  try {
    const fetchFn = getFetch();
    const noVncUrl = resolveNoVncUrl(config);
    const parsed = new URL(noVncUrl);
    const rootUrl = `${parsed.origin}/`;
    const res = await fetchFn(rootUrl, {
      method: 'GET',
      signal: AbortSignal.timeout(3_000),
    });
    return res.ok;
  } catch {
    return false;
  }
}
