/**
 * @license
 * Copyright 2026 cofy-x
 * SPDX-License-Identifier: Apache-2.0
 */
import { invoke } from '@tauri-apps/api/core';

import { isTauriRuntime } from '@/lib/utils';

type LogLevel = 'info' | 'warn' | 'error' | 'debug';

function sendLog(level: LogLevel, tag: string, message: string) {
  if (!isTauriRuntime()) return;
  void invoke('log_frontend_message', { level, tag, message }).catch(() => {
    // Swallow -- must not recurse into console.error
  });
}

export function tauriLogInfo(tag: string, message: string): void {
  sendLog('info', tag, message);
}

export function tauriLogWarn(tag: string, message: string): void {
  sendLog('warn', tag, message);
}

export function tauriLogError(tag: string, message: string): void {
  sendLog('error', tag, message);
}

function argsToString(args: unknown[]): string {
  return args
    .map((a) => {
      if (typeof a === 'string') return a;
      if (a instanceof Error) return `${a.name}: ${a.message}`;
      try {
        return JSON.stringify(a);
      } catch {
        return String(a);
      }
    })
    .join(' ');
}

/**
 * Override `console.error` and `console.warn` so that messages are also
 * forwarded to `deck.log` via the Tauri backend. Only active in Tauri
 * runtime (production desktop builds). The original console methods are
 * preserved and still called.
 */
export function installConsoleBridge(): void {
  if (!isTauriRuntime()) return;

  const originalError = console.error.bind(console);
  const originalWarn = console.warn.bind(console);

  console.error = (...args: unknown[]) => {
    originalError(...args);
    sendLog('error', 'console', argsToString(args));
  };

  console.warn = (...args: unknown[]) => {
    originalWarn(...args);
    sendLog('warn', 'console', argsToString(args));
  };
}
