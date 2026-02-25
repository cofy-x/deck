/**
 * @license
 * Copyright 2026 cofy-x
 * SPDX-License-Identifier: Apache-2.0
 */

import { ProxyAgent, fetch as undiciFetch } from 'undici';
import type { RequestInfo, RequestInit, Response } from 'undici';

// ---------------------------------------------------------------------------
// Proxy-aware fetch
// ---------------------------------------------------------------------------

function resolveProxyUrl(targetUrl: string): string | undefined {
  const noProxy = process.env['NO_PROXY'] || process.env['no_proxy'];
  if (noProxy) {
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

  const isHttps = targetUrl.startsWith('https://');
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
 * Proxy-aware fetch that respects HTTP_PROXY, HTTPS_PROXY, and NO_PROXY
 * environment variables.
 */
export async function proxyFetch(
  input: RequestInfo,
  init?: RequestInit,
): Promise<Response> {
  const url =
    typeof input === 'string'
      ? input
      : input instanceof URL
        ? input.href
        : input.url;
  const proxyUrl = resolveProxyUrl(url);

  if (proxyUrl) {
    const dispatcher = new ProxyAgent(proxyUrl);
    return undiciFetch(input, { ...init, dispatcher });
  }

  return undiciFetch(input, init);
}
