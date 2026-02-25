/**
 * @license
 * Copyright 2026 cofy-x
 * SPDX-License-Identifier: Apache-2.0
 */

import type { WorkspaceInfo } from '../types/index.js';
import { ApiError } from '../errors.js';
import {
  resolveOpencodeDirectory,
  buildOpencodeAuthHeader,
} from '../services/workspace.service.js';

const PROXY_HEADER_ALLOWLIST = new Set([
  'accept',
  'content-type',
  'content-length',
  'if-match',
  'if-none-match',
  'if-modified-since',
  'if-unmodified-since',
  'range',
  'x-request-id',
  'x-opencode-directory',
]);

function buildProxyHeaders(source: Headers): Headers {
  const headers = new Headers();
  for (const [key, value] of source.entries()) {
    const normalized = key.toLowerCase();
    if (!PROXY_HEADER_ALLOWLIST.has(normalized)) continue;
    headers.append(normalized, value);
  }
  return headers;
}

function buildOpencodeProxyUrl(
  baseUrl: string,
  path: string,
  search: string,
): string {
  const target = new URL(baseUrl);
  const trimmedPath = path.replace(/^\/opencode/, '');
  target.pathname = trimmedPath.startsWith('/')
    ? trimmedPath
    : `/${trimmedPath}`;
  target.search = search;
  return target.toString();
}

export interface ProxyOpencodeRequestInput {
  request: Request;
  url: URL;
  workspace?: WorkspaceInfo;
  proxyPath?: string;
}

export async function proxyOpencodeRequest(
  input: ProxyOpencodeRequestInput,
): Promise<Response> {
  const workspace = input.workspace;
  const baseUrl = workspace?.baseUrl?.trim() ?? '';
  if (!baseUrl) {
    throw new ApiError(
      400,
      'opencode_unconfigured',
      'OpenCode base URL is missing for this workspace',
    );
  }

  const proxyPath = input.proxyPath ?? input.url.pathname;
  const targetUrl = buildOpencodeProxyUrl(baseUrl, proxyPath, input.url.search);
  const headers = buildProxyHeaders(input.request.headers);

  const directory = workspace ? resolveOpencodeDirectory(workspace) : null;
  if (directory && !headers.has('x-opencode-directory')) {
    headers.set('x-opencode-directory', directory);
  }

  const auth = workspace ? buildOpencodeAuthHeader(workspace) : null;
  if (auth) {
    headers.set('Authorization', auth);
  }

  const method = input.request.method.toUpperCase();
  const body =
    method === 'GET' || method === 'HEAD' ? undefined : input.request.body;
  if (!body) {
    headers.delete('content-length');
  }
  const init: RequestInit = {
    method,
    headers,
  };
  if (body) {
    init.body = body;
    init.duplex = 'half';
  }
  return fetch(targetUrl, init);
}
