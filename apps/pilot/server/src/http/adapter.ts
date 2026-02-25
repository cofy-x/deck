/**
 * @license
 * Copyright 2026 cofy-x
 * SPDX-License-Identifier: Apache-2.0
 */

import type { IncomingMessage, ServerResponse } from 'node:http';
import { ApiError } from '../errors.js';

const DEFAULT_MAX_BODY_BYTES = 1024 * 1024;

export function collectBody(
  req: IncomingMessage,
  maxBodyBytes = DEFAULT_MAX_BODY_BYTES,
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let total = 0;
    let ended = false;
    let settled = false;

    const fail = (error: ApiError | Error) => {
      if (settled) return;
      settled = true;
      reject(error);
    };

    const done = (body: Buffer) => {
      if (settled) return;
      settled = true;
      resolve(body);
    };

    req.on('data', (chunk: Buffer) => {
      if (settled) return;
      total += chunk.length;
      if (total > maxBodyBytes) {
        fail(
          new ApiError(413, 'payload_too_large', 'Request body is too large', {
            limit: maxBodyBytes,
          }),
        );
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => {
      ended = true;
      done(Buffer.concat(chunks));
    });
    req.on('aborted', () => {
      fail(new ApiError(400, 'request_aborted', 'Request stream aborted'));
    });
    req.on('close', () => {
      if (ended || settled) return;
      fail(new ApiError(400, 'request_aborted', 'Request stream closed'));
    });
    req.on('error', (error) => fail(error instanceof Error ? error : new Error(String(error))));
  });
}

interface IncomingToRequestOptions {
  body?: Buffer;
  streamBody?: boolean;
}

export async function incomingToRequest(
  req: IncomingMessage,
  options: IncomingToRequestOptions = {},
): Promise<Request> {
  const { body, streamBody = false } = options;
  const host = req.headers.host ?? 'localhost';
  const url = `http://${host}${req.url ?? '/'}`;
  const method = req.method ?? 'GET';
  const headers = new Headers();
  for (const [key, value] of Object.entries(req.headers)) {
    if (value) {
      if (Array.isArray(value)) {
        for (const v of value) {
          headers.append(key, v);
        }
      } else {
        headers.set(key, value);
      }
    }
  }

  const hasBody = method !== 'GET' && method !== 'HEAD';
  const init: RequestInit = {
    method,
    headers,
  };
  if (hasBody) {
    if (streamBody) {
      init.body = req as unknown as NonNullable<RequestInit['body']>;
      init.duplex = 'half';
    } else if (body) {
      init.body = body;
      init.duplex = 'half';
    }
  }
  return new Request(url, init);
}

export async function writeWebResponse(
  webResponse: Response,
  res: ServerResponse,
): Promise<void> {
  const headersRecord: Record<string, string | string[]> = {};
  webResponse.headers.forEach((value, key) => {
    const existing = headersRecord[key];
    if (existing === undefined) {
      headersRecord[key] = value;
      return;
    }
    if (Array.isArray(existing)) {
      existing.push(value);
      headersRecord[key] = existing;
      return;
    }
    headersRecord[key] = [existing, value];
  });
  res.writeHead(webResponse.status, headersRecord);

  if (webResponse.body) {
    const reader = webResponse.body.getReader();
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        res.write(value);
      }
    } finally {
      reader.releaseLock();
    }
  }
  res.end();
}
