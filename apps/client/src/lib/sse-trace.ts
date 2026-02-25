/**
 * @license
 * Copyright 2026 cofy-x
 * SPDX-License-Identifier: Apache-2.0
 */
import { invoke } from '@tauri-apps/api/core';

import { isTauriRuntime } from '@/lib/utils';
import { useDebugStore } from '@/stores/debug-store';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SseTraceParams {
  url: string;
  summary?: string;
  requestBody?: string;
  responseBody?: string;
  error?: string;
}

// ---------------------------------------------------------------------------
// Internal state (module-scoped; reset via `resetTraceState`)
// ---------------------------------------------------------------------------

let entryCounter = 0;
let tracePathResolved = false;
let tracePathPromise: Promise<string | null> | null = null;

export function resetTraceState(): void {
  tracePathResolved = false;
  tracePathPromise = null;
}

// ---------------------------------------------------------------------------
// Tauri file trace
// ---------------------------------------------------------------------------

function appendTraceEntry(params: SseTraceParams & { timestamp: number }) {
  if (!isTauriRuntime()) return;
  void invoke('log_sse_trace_entry', {
    entry: {
      timestamp: params.timestamp,
      url: params.url,
      summary: params.summary,
      requestBody: params.requestBody,
      responseBody: params.responseBody,
      error: params.error,
    },
  }).catch(() => {
    // Silently ignore file logging errors -- Rust side truncates fields.
  });
}

function resolveTraceLogPath(): Promise<string | null> {
  if (!isTauriRuntime()) return Promise.resolve(null);
  if (!tracePathPromise) {
    tracePathPromise = invoke<string>('get_sse_trace_log_path').catch(
      () => null,
    );
  }
  return tracePathPromise;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Write an entry to the Tauri SSE trace file **only** (no debug panel).
 * Used for high-frequency events like `message.part.delta`.
 */
export function pushSseTraceOnlyEntry(params: SseTraceParams): void {
  const store = useDebugStore.getState();
  if (!store.enabled || store.paused) return;
  appendTraceEntry({ ...params, timestamp: Date.now() });
}

/**
 * Write an entry to **both** the debug panel and the Tauri SSE trace file.
 */
export function pushSseDebugEntry(params: SseTraceParams): void {
  const store = useDebugStore.getState();
  if (!store.enabled || store.paused) return;

  const timestamp = Date.now();
  entryCounter += 1;
  store.addEntry({
    id: `sse-${timestamp}-${entryCounter}`,
    timestamp,
    method: 'SSE',
    url: params.url,
    summary: params.summary,
    requestBody: params.requestBody,
    responseBody: params.responseBody,
    error: params.error,
  });

  appendTraceEntry({ ...params, timestamp });

  if (!tracePathResolved) {
    tracePathResolved = true;
    void resolveTraceLogPath().then((path) => {
      if (!path) return;
      entryCounter += 1;
      store.addEntry({
        id: `sse-${Date.now()}-${entryCounter}`,
        timestamp: Date.now(),
        method: 'SSE',
        url: '/event',
        summary: 'trace.file',
        responseBody: path,
      });
    });
  }
}
