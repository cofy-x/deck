/**
 * @license
 * Copyright 2025 cofy-x
 * SPDX-License-Identifier: Apache-2.0
 */

import type { Agent as HttpsAgent } from 'node:https';

import { ProxyAgent } from 'proxy-agent';

// ---------------------------------------------------------------------------
// Proxy support
// ---------------------------------------------------------------------------

/**
 * Resolve proxy URL from environment variables.
 * Checks HTTPS_PROXY, HTTP_PROXY, ALL_PROXY (case-insensitive).
 * Returns undefined if no proxy is configured or target matches NO_PROXY.
 */
export function resolveProxyUrl(targetUrl?: string): string | undefined {
  const noProxy = process.env['NO_PROXY'] || process.env['no_proxy'];
  if (noProxy && targetUrl) {
    try {
      const host = new URL(targetUrl).hostname;
      const entries = noProxy.split(',').map((e) => e.trim().toLowerCase());
      for (const entry of entries) {
        if (!entry) continue;
        if (entry === '*') return undefined;
        if (host === entry || host.endsWith(`.${entry}`)) return undefined;
      }
    } catch {
      // ignore parse errors
    }
  }

  const isHttps = targetUrl?.startsWith('https://');
  if (isHttps) {
    const httpsProxy = process.env['HTTPS_PROXY'] || process.env['https_proxy'];
    if (httpsProxy) return httpsProxy;
  }
  const httpProxy = process.env['HTTP_PROXY'] || process.env['http_proxy'];
  if (httpProxy) return httpProxy;
  const allProxy = process.env['ALL_PROXY'] || process.env['all_proxy'];
  if (allProxy) return allProxy;
  return undefined;
}

/**
 * Create an HTTP agent that respects proxy environment variables.
 * Returns undefined if no proxy is configured.
 */
export function createProxyAgent(targetUrl?: string): HttpsAgent | undefined {
  const proxyUrl = resolveProxyUrl(targetUrl);
  if (!proxyUrl) return undefined;
  return new ProxyAgent({
    getProxyForUrl: () => proxyUrl,
  });
}

// ---------------------------------------------------------------------------
// Error formatting
// ---------------------------------------------------------------------------

/**
 * Safely format an error value into a human-readable string.
 * Handles Error objects, strings, and arbitrary objects.
 */
export function formatError(error: unknown): string {
  if (error instanceof Error) {
    let msg = error.message;
    if (error.cause) {
      msg += `: ${formatError(error.cause)}`;
    }
    return msg;
  }
  if (typeof error === 'string') {
    return error;
  }
  if (error === null || error === undefined) {
    return 'Unknown error';
  }
  try {
    return JSON.stringify(error);
  } catch {
    return String(error);
  }
}

/**
 * Format an error with optional stack trace for detailed logging.
 */
export function formatErrorDetail(error: unknown): {
  message: string;
  stack?: string;
} {
  if (error instanceof Error) {
    return { message: error.message, stack: error.stack };
  }
  return { message: formatError(error) };
}
