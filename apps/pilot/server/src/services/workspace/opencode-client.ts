/**
 * @license
 * Copyright 2026 cofy-x
 * SPDX-License-Identifier: Apache-2.0
 */

import type { JsonValue, WorkspaceInfo } from '../../types/index.js';
import { ApiError } from '../../errors.js';

export function resolveOpencodeDirectory(
  workspace: WorkspaceInfo,
): string | null {
  const explicit = workspace.directory?.trim() ?? '';
  if (explicit) return explicit;
  if (workspace.workspaceType === 'local') return workspace.path;
  return null;
}

export function buildOpencodeAuthHeader(
  workspace: WorkspaceInfo,
): string | null {
  const username = workspace.opencodeUsername?.trim() ?? '';
  const password = workspace.opencodePassword?.trim() ?? '';
  if (!username || !password) return null;
  return `Basic ${Buffer.from(`${username}:${password}`).toString('base64')}`;
}

function buildOpencodeReloadUrl(
  baseUrl: string,
  directory?: string | null,
): string {
  try {
    const url = new URL(baseUrl);
    url.pathname = '/instance/dispose';
    url.search = '';
    if (directory) {
      url.searchParams.set('directory', directory);
    }
    return url.toString();
  } catch {
    throw new ApiError(
      400,
      'opencode_url_invalid',
      'OpenCode base URL is invalid',
    );
  }
}

function parseOpencodeErrorBody(input: string): JsonValue {
  const trimmed = input.trim();
  if (!trimmed) return null;
  try {
    return JSON.parse(trimmed) as JsonValue;
  } catch {
    return trimmed;
  }
}

export async function reloadOpencodeEngine(
  workspace: WorkspaceInfo,
): Promise<void> {
  const baseUrl = workspace.baseUrl?.trim() ?? '';
  if (!baseUrl) {
    throw new ApiError(
      400,
      'opencode_unconfigured',
      'OpenCode base URL is missing for this workspace',
    );
  }

  const directory = resolveOpencodeDirectory(workspace);
  const targetUrl = buildOpencodeReloadUrl(baseUrl, directory);
  const headers: Record<string, string> = {};
  const auth = buildOpencodeAuthHeader(workspace);
  if (auth) headers['Authorization'] = auth;

  const response = await fetch(targetUrl, { method: 'POST', headers });
  if (response.ok) return;
  const body = parseOpencodeErrorBody(await response.text());
  throw new ApiError(502, 'opencode_reload_failed', 'OpenCode reload failed', {
    status: response.status,
    body,
  });
}
