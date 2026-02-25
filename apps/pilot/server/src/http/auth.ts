/**
 * @license
 * Copyright 2026 cofy-x
 * SPDX-License-Identifier: Apache-2.0
 */

import type { Actor, ServerConfig } from '../types/index.js';
import { ApiError } from '../errors.js';
import { hashToken } from '../utils/crypto.js';

export function requireClient(request: Request, config: ServerConfig): Actor {
  const header = request.headers.get('authorization') ?? '';
  const match = header.match(/^Bearer\s+(.+)$/i);
  const token = match?.[1];
  if (!token || token !== config.token) {
    throw new ApiError(401, 'unauthorized', 'Invalid bearer token');
  }
  const clientId = request.headers.get('x-pilot-client-id') ?? undefined;
  return { type: 'remote', clientId, tokenHash: hashToken(token) };
}

export function requireHost(request: Request, config: ServerConfig): Actor {
  const token = request.headers.get('x-pilot-host-token');
  if (!token || token !== config.hostToken) {
    throw new ApiError(401, 'unauthorized', 'Invalid host token');
  }
  return { type: 'host', tokenHash: hashToken(token) };
}
