/**
 * @license
 * Copyright 2026 cofy-x
 * SPDX-License-Identifier: Apache-2.0
 */

import type { ServerConfig } from '../types/index.js';

export function withCors(
  response: Response,
  request: Request,
  config: ServerConfig,
): Response {
  const origin = request.headers.get('origin');
  const allowedOrigins = config.corsOrigins;
  let allowOrigin: string | null = null;
  if (allowedOrigins.includes('*')) {
    allowOrigin = '*';
  } else if (origin && allowedOrigins.includes(origin)) {
    allowOrigin = origin;
  }

  if (!allowOrigin) return response;
  const headers = new Headers(response.headers);
  headers.set('Access-Control-Allow-Origin', allowOrigin);
  headers.set(
    'Access-Control-Allow-Headers',
    'Authorization, Content-Type, X-Pilot-Host-Token, X-Pilot-Client-Id, X-OpenCode-Directory, X-Opencode-Directory, x-opencode-directory',
  );
  headers.set('Access-Control-Allow-Methods', 'GET,POST,PATCH,DELETE,OPTIONS');
  headers.set('Vary', 'Origin');
  return new Response(response.body, { status: response.status, headers });
}
