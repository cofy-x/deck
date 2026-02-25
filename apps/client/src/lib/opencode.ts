/**
 * @license
 * Copyright 2026 cofy-x
 * SPDX-License-Identifier: Apache-2.0
 */
import {
  createOpencodeClient,
  type OpencodeClient,
} from '@opencode-ai/sdk/v2/client';
import { fetch as tauriFetch } from '@tauri-apps/plugin-http';
import { invoke } from '@tauri-apps/api/core';

import { isTauriRuntime } from './utils';
import { LOCAL_OPENCODE_BASE_URL } from './constants';
import { useDebugStore } from '@/stores/debug-store';
import type { DebugLogEntry } from '@/stores/debug-store';

// ---------------------------------------------------------------------------
// API call logging (dev diagnostics via Tauri backend console)
// ---------------------------------------------------------------------------

interface ApiLogEntry {
  method: string;
  url: string;
  status?: number;
  durationMs?: number;
  error?: string;
}

export interface OpencodeAuth {
  username?: string;
  password?: string;
}

export interface CreateClientInput {
  baseUrl?: string;
  auth?: OpencodeAuth;
  onUnauthorized?: (context: UnauthorizedContext) => void;
}

const IS_DEV = import.meta.env.DEV;
const UNAUTHORIZED_STATUS_CODES = new Set([401, 403]);

export interface UnauthorizedContext {
  status: number;
  url: string;
}

/**
 * Send an API call log entry to the Tauri backend.
 * In dev mode this prints method, url, status, timing, and
 * errors to the Rust console as one-line summaries.
 * Errors are swallowed to avoid interfering with the actual request.
 */
function logApiCall(entry: ApiLogEntry) {
  if (!IS_DEV || !isTauriRuntime()) return;
  invoke('log_api_call', { entry }).catch(() => {
    // Silently ignore logging errors
  });
}

/**
 * Safely extract a body preview string from RequestInit.
 */
function extractBodyPreview(init?: RequestInit): string | undefined {
  if (!init?.body) return undefined;
  if (typeof init.body === 'string') {
    const sanitized = sanitizeLogBody(init.body);
    return sanitized.length > 1000 ? sanitized.slice(0, 1000) : sanitized;
  }
  return '[non-string body]';
}

/**
 * SSE responses are long-lived streams; reading cloned body text blocks until
 * the stream closes and can stall consumers that are waiting on the response.
 */
function shouldSkipResponseBodyLogging(response: Response): boolean {
  const contentType = response.headers.get('content-type')?.toLowerCase() ?? '';
  return contentType.includes('text/event-stream');
}

interface ApiSummaryLogParams {
  method: string;
  url: string;
  durationMs: number;
  status?: number;
  error?: string;
}

function buildApiSummaryLogEntry(params: ApiSummaryLogParams): ApiLogEntry {
  return {
    method: params.method,
    url: params.url,
    durationMs: params.durationMs,
    ...(params.status !== undefined ? { status: params.status } : {}),
    ...(params.error ? { error: params.error } : {}),
  };
}

/**
 * Safely extract a full response body for debug logging.
 * Uses per-endpoint limits to balance observability and memory usage:
 * - `/session/{id}/message(s)`: keep full body
 * - other endpoints: truncate to configured character limit
 */
async function extractResponseFull(
  response: Response,
  url: string,
): Promise<string | undefined> {
  try {
    const cloned = response.clone();
    const text = sanitizeLogBody(await cloned.text());
    const limit = getDebugResponseBodyLimit(url);
    if (limit === null) return text;
    return text.length > limit
      ? text.slice(0, limit) + '\n...(truncated)'
      : text;
  } catch {
    return undefined;
  }
}

/**
 * Decide per-endpoint response body capture limit for Debug Log.
 * - `null`: keep full body
 * - number: truncate to at most this many characters
 */
function getDebugResponseBodyLimit(url: string): number | null {
  const path = (() => {
    try {
      return new URL(url).pathname;
    } catch {
      return url;
    }
  })();

  // Examples:
  // - /session/<sessionId>/message
  // - /session/<sessionId>/messages
  if (/\/session\/[^/]+\/messages?$/.test(path)) {
    return null;
  }
  // Keep larger payloads for most APIs while avoiding unbounded memory growth.
  return 200_000;
}

/**
 * Remove large inline file payloads from logs (e.g. data:image/png;base64,...).
 * Keeps MIME metadata while stripping raw bytes to keep API Log readable.
 */
function sanitizeLogBody(text: string): string {
  return text.replace(
    /data:([a-z0-9.+-]+\/[a-z0-9.+-]+)(;charset=[^;,]+)?;base64,[a-z0-9+/=\s]+/gi,
    (_match, mime: string) => `data:${mime};base64,[omitted]`,
  );
}

let debugEntryCounter = 0;

/**
 * Push an entry to the in-memory debug log store (if debug mode is enabled).
 */
function pushDebugEntry(partial: Omit<DebugLogEntry, 'id' | 'timestamp'>) {
  const store = useDebugStore.getState();
  if (!store.enabled) return;
  debugEntryCounter += 1;
  store.addEntry({
    ...partial,
    id: `dbg-${Date.now()}-${debugEntryCounter}`,
    timestamp: Date.now(),
  });
}

function encodeBase64Utf8(value: string): string | null {
  if (typeof btoa !== 'function') return null;
  if (typeof TextEncoder === 'undefined') return null;

  const bytes = new TextEncoder().encode(value);
  let binary = '';
  const chunkSize = 0x8000;

  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode(...chunk);
  }

  return btoa(binary);
}

function resolveAuthHeader(auth?: OpencodeAuth): string | null {
  if (!auth?.username || !auth?.password) return null;
  const credentials = encodeBase64Utf8(`${auth.username}:${auth.password}`);
  if (!credentials) return null;
  return `Basic ${credentials}`;
}

function applyAuthHeader(headers: Headers, authHeader: string | null): Headers {
  if (authHeader && !headers.has('Authorization')) {
    headers.set('Authorization', authHeader);
  }
  return headers;
}

function isUnauthorizedStatus(status: number): boolean {
  return UNAUTHORIZED_STATUS_CODES.has(status);
}

function notifyUnauthorized(
  status: number,
  url: string,
  onUnauthorized?: (context: UnauthorizedContext) => void,
) {
  if (!onUnauthorized || !isUnauthorizedStatus(status)) return;
  onUnauthorized({ status, url });
}

// ---------------------------------------------------------------------------
// Tauri-aware fetch wrapper (with logging)
// ---------------------------------------------------------------------------

function createTauriFetch(
  auth?: OpencodeAuth,
  onUnauthorized?: (context: UnauthorizedContext) => void,
) {
  const authHeader = resolveAuthHeader(auth);
  return async (
    input: RequestInfo | URL,
    init?: RequestInit,
  ): Promise<Response> => {
    const resolvedInput: RequestInfo | URL =
      input instanceof Request
        ? new Request(input, {
            headers: applyAuthHeader(new Headers(input.headers), authHeader),
          })
        : input;
    const resolvedInit: RequestInit | undefined =
      input instanceof Request
        ? init
        : {
            ...init,
            headers: applyAuthHeader(new Headers(init?.headers), authHeader),
          };
    const url =
      resolvedInput instanceof Request
        ? resolvedInput.url
        : resolvedInput instanceof URL
          ? resolvedInput.toString()
          : resolvedInput;
    const method =
      resolvedInit?.method ??
      (resolvedInput instanceof Request ? resolvedInput.method : 'GET');
    const bodyPreview = extractBodyPreview(resolvedInit);
    const start = performance.now();

    try {
      const response =
        resolvedInput instanceof Request
          ? await tauriFetch(resolvedInput)
          : await tauriFetch(resolvedInput, resolvedInit);

      const durationMs = Math.round(performance.now() - start);
      const skipBodyLogging = shouldSkipResponseBodyLogging(response);
      notifyUnauthorized(response.status, url, onUnauthorized);

      logApiCall(
        buildApiSummaryLogEntry({
          method,
          url,
          status: response.status,
          durationMs,
        }),
      );

      // Push to debug log (full body)
      const debugResponseBody = skipBodyLogging
        ? '[stream omitted]'
        : await extractResponseFull(response, url);
      pushDebugEntry({
        method,
        url,
        status: response.status,
        durationMs,
        requestBody: bodyPreview,
        responseBody: debugResponseBody,
      });

      return response;
    } catch (err) {
      const durationMs = Math.round(performance.now() - start);
      const errorMsg = err instanceof Error ? err.message : String(err);
      logApiCall(
        buildApiSummaryLogEntry({
          method,
          url,
          durationMs,
          error: errorMsg,
        }),
      );

      pushDebugEntry({
        method,
        url,
        requestBody: bodyPreview,
        durationMs,
        error: errorMsg,
      });

      throw err;
    }
  };
}

// ---------------------------------------------------------------------------
// Client factory
// ---------------------------------------------------------------------------

/**
 * Create an OpenCode SDK client for a local or remote OpenCode endpoint.
 * Uses Tauri's HTTP plugin when running inside the Tauri shell, and
 * falls back to native `fetch` in the browser (dev mode).
 */
/**
 * Wrap native `fetch` with debug logging (used in non-Tauri environments).
 */
function createDebugFetch(
  onUnauthorized?: (context: UnauthorizedContext) => void,
) {
  return async (
    input: RequestInfo | URL,
    init?: RequestInit,
  ): Promise<Response> => {
    const url =
      input instanceof Request
        ? input.url
        : input instanceof URL
          ? input.toString()
          : input;
    const method =
      init?.method ?? (input instanceof Request ? input.method : 'GET');
    const bodyPreview = extractBodyPreview(init);
    const start = performance.now();

    try {
      const response = await globalThis.fetch(input, init);
      const durationMs = Math.round(performance.now() - start);
      const skipBodyLogging = shouldSkipResponseBodyLogging(response);
      notifyUnauthorized(response.status, url, onUnauthorized);
      const debugResponseBody = skipBodyLogging
        ? '[stream omitted]'
        : await extractResponseFull(response, url);
      pushDebugEntry({
        method,
        url,
        requestBody: bodyPreview,
        status: response.status,
        durationMs,
        responseBody: debugResponseBody,
      });
      return response;
    } catch (err) {
      const durationMs = Math.round(performance.now() - start);
      pushDebugEntry({
        method,
        url,
        requestBody: bodyPreview,
        durationMs,
        error: err instanceof Error ? err.message : String(err),
      });
      throw err;
    }
  };
}

function createDebugFetchWithAuth(
  auth?: OpencodeAuth,
  onUnauthorized?: (context: UnauthorizedContext) => void,
) {
  const authHeader = resolveAuthHeader(auth);
  const debugFetch = createDebugFetch(onUnauthorized);
  return async (
    input: RequestInfo | URL,
    init?: RequestInit,
  ): Promise<Response> => {
    const resolvedInput: RequestInfo | URL =
      input instanceof Request
        ? new Request(input, {
            headers: applyAuthHeader(new Headers(input.headers), authHeader),
          })
        : input;
    const resolvedInit: RequestInit | undefined =
      input instanceof Request
        ? init
        : {
            ...init,
            headers: applyAuthHeader(new Headers(init?.headers), authHeader),
          };

    return debugFetch(resolvedInput, resolvedInit);
  };
}

export function createClient(input?: CreateClientInput) {
  const fetchImpl = isTauriRuntime()
    ? createTauriFetch(input?.auth, input?.onUnauthorized)
    : createDebugFetchWithAuth(input?.auth, input?.onUnauthorized);
  return createOpencodeClient({
    baseUrl: input?.baseUrl ?? LOCAL_OPENCODE_BASE_URL,
    fetch: fetchImpl,
  });
}

// ---------------------------------------------------------------------------
// Result unwrapper
// ---------------------------------------------------------------------------

/**
 * Unwrap an SDK client result.
 *
 * The generated SDK client returns `{ data, error, request, response }`.
 * On success `data` is set; on failure `error` is set. This helper extracts
 * the success payload or throws a descriptive error.
 */
export function unwrap<T>(result: {
  data?: T;
  error?: unknown;
}): NonNullable<T> {
  if (result.data !== undefined && result.data !== null) {
    return result.data as NonNullable<T>;
  }
  const err = result.error;
  let message: string;
  if (err instanceof Error) {
    message = err.message;
  } else if (typeof err === 'string') {
    message = err;
  } else if (err && typeof err === 'object' && 'data' in err) {
    message = JSON.stringify(err);
  } else {
    message = 'Request failed';
  }
  throw new Error(message);
}

// ---------------------------------------------------------------------------
// Health check
// ---------------------------------------------------------------------------

const AUTH_STATUS_CODES = UNAUTHORIZED_STATUS_CODES;
export const UNAUTHORIZED_MESSAGE =
  'Unauthorized: invalid OpenCode credentials or access denied';

class UnauthorizedConnectionError extends Error {
  constructor(message = UNAUTHORIZED_MESSAGE) {
    super(message);
    this.name = 'UnauthorizedConnectionError';
  }
}

interface ErrorWithDataMessage {
  data?: {
    message?: string;
  };
}

function isAuthStatus(status: number): boolean {
  return AUTH_STATUS_CODES.has(status);
}

function toErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  const dataMessage =
    error && typeof error === 'object'
      ? (error as ErrorWithDataMessage).data?.message
      : undefined;
  if (typeof dataMessage === 'string') {
    return dataMessage;
  }
  if (error && typeof error === 'object') {
    try {
      return JSON.stringify(error);
    } catch {
      return 'Connection failed';
    }
  }
  return 'Connection failed';
}

function formatHttpError(status: number, statusText: string): string {
  const trimmed = statusText.trim();
  return trimmed ? `HTTP ${status} ${trimmed}` : `HTTP ${status}`;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Poll the OpenCode server until it reports healthy, or timeout.
 */
export async function waitForHealthy(
  client: OpencodeClient,
  options?: { timeoutMs?: number; pollMs?: number },
) {
  const timeoutMs = options?.timeoutMs ?? 30_000;
  const pollMs = options?.pollMs ?? 1_000;

  const start = Date.now();
  let lastError: string | null = null;

  while (Date.now() - start < timeoutMs) {
    try {
      const result = await client.global.health({ throwOnError: false });
      const status = result.response.status;

      if (isAuthStatus(status)) {
        throw new UnauthorizedConnectionError();
      }

      if (!result.response.ok) {
        lastError = formatHttpError(status, result.response.statusText);
        await sleep(pollMs);
        continue;
      }

      if (result.error) {
        lastError = toErrorMessage(result.error);
        await sleep(pollMs);
        continue;
      }

      const health = unwrap(result);
      if (health.healthy) {
        return health;
      }
      lastError = 'Server reported unhealthy';
    } catch (error) {
      if (error instanceof UnauthorizedConnectionError) {
        throw error;
      }
      lastError = toErrorMessage(error);
    }
    await sleep(pollMs);
  }

  throw new Error(lastError ?? 'Timed out waiting for server health');
}
