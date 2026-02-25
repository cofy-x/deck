/**
 * @license
 * Copyright 2025 cofy-x
 * SPDX-License-Identifier: Apache-2.0
 */

import http from 'node:http';

import type { Logger } from 'pino';

export interface HttpEventRequest {
  method: string;
  pathname: string;
  body: string;
  headers: http.IncomingHttpHeaders;
}

export interface HttpEventResponse {
  status: number;
  body: object;
}

export interface HttpEventServerOptions {
  port: number;
  path: string;
  logger: Logger;
  onRequest: (
    request: HttpEventRequest,
  ) => Promise<HttpEventResponse | null> | HttpEventResponse | null;
}

const MAX_BODY_SIZE = 1024 * 1024;

async function readBody(req: http.IncomingMessage): Promise<string | null> {
  let raw = '';
  for await (const chunk of req) {
    raw += chunk.toString();
    if (raw.length > MAX_BODY_SIZE) {
      return null;
    }
  }
  return raw;
}

export function startHttpEventServer(options: HttpEventServerOptions): {
  stop: () => Promise<void>;
} {
  const normalizedPath = options.path.startsWith('/')
    ? options.path
    : `/${options.path}`;

  const server = http.createServer((req, res) => {
    void (async () => {
      const method = req.method ?? 'GET';
      const pathname = req.url
        ? new URL(req.url, 'http://localhost').pathname
        : '/';

      if (pathname !== normalizedPath || method !== 'POST') {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: false, error: 'Not found' }));
        return;
      }

      const body = await readBody(req);
      if (body === null) {
        res.writeHead(413, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: false, error: 'Payload too large' }));
        return;
      }

      const response = await options.onRequest({
        method,
        pathname,
        body,
        headers: req.headers,
      });
      const status = response?.status ?? 200;
      const responseBody = response?.body ?? { ok: true };

      res.writeHead(status, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(responseBody));
    })().catch((error) => {
      options.logger.error({ error }, 'http event request failed');
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: false, error: 'Internal error' }));
    });
  });

  server.listen(options.port, '0.0.0.0', () => {
    options.logger.info(
      { port: options.port, path: normalizedPath },
      'http event server listening',
    );
  });

  return {
    stop: () =>
      new Promise<void>((resolve) => {
        server.close(() => resolve());
      }),
  };
}
