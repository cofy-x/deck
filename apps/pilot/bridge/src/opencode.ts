/**
 * @license
 * Copyright 2025 cofy-x
 * SPDX-License-Identifier: Apache-2.0
 */

import { Buffer } from 'node:buffer';

import {
  createOpencodeClient,
  type OpencodeClient,
} from '@opencode-ai/sdk/v2/client';

import type { Config, PermissionMode } from './types/index.js';

export type { OpencodeClient };

// ---------------------------------------------------------------------------
// Permission rule type
// ---------------------------------------------------------------------------

interface PermissionRule {
  permission: string;
  pattern: string;
  action: 'allow' | 'deny';
}

// ---------------------------------------------------------------------------
// Client factory
// ---------------------------------------------------------------------------

export function createClient(config: Config): OpencodeClient {
  const headers: Record<string, string> = {};
  if (config.opencodeUsername && config.opencodePassword) {
    const token = Buffer.from(
      `${config.opencodeUsername}:${config.opencodePassword}`,
    ).toString('base64');
    headers['Authorization'] = `Basic ${token}`;
  }

  return createOpencodeClient({
    baseUrl: config.opencodeUrl,
    directory: config.opencodeDirectory,
    headers: Object.keys(headers).length ? headers : undefined,
    throwOnError: true,
  });
}

// ---------------------------------------------------------------------------
// Permission rules builder
// ---------------------------------------------------------------------------

export function buildPermissionRules(mode: PermissionMode): PermissionRule[] {
  const action = mode === 'deny' ? 'deny' : 'allow';
  return [{ permission: '*', pattern: '*', action }];
}
