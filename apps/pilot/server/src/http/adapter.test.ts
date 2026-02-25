/**
 * @license
 * Copyright 2026 cofy-x
 * SPDX-License-Identifier: Apache-2.0
 */

import type { IncomingMessage, ServerResponse } from 'node:http';
import { EventEmitter } from 'node:events';
import { PassThrough } from 'node:stream';
import { describe, expect, test } from 'vitest';
import { collectBody, writeWebResponse } from './adapter.js';

describe('collectBody', () => {
  test('collects body within size limit', async () => {
    const stream = new PassThrough();
    const req = stream as unknown as IncomingMessage;

    const pending = collectBody(req, 20);
    stream.end(Buffer.from('hello'));

    const body = await pending;
    expect(body.toString('utf8')).toBe('hello');
  });

  test('throws 413 when body exceeds max bytes', async () => {
    const stream = new PassThrough();
    const req = stream as unknown as IncomingMessage;

    const pending = collectBody(req, 5);
    stream.end(Buffer.from('payload too large'));

    await expect(pending).rejects.toMatchObject({
      status: 413,
      code: 'payload_too_large',
    });
  });

  test('throws 400 when request stream closes before end', async () => {
    const stream = new PassThrough();
    const req = stream as unknown as IncomingMessage;

    const pending = collectBody(req, 20);
    stream.write(Buffer.from('half'));
    stream.emit('close');

    await expect(pending).rejects.toMatchObject({
      status: 400,
      code: 'request_aborted',
    });
  });
});

describe('writeWebResponse', () => {
  test('preserves multi-value response headers', async () => {
    const events = new EventEmitter();
    let capturedStatus = 0;
    let capturedHeaders: Record<string, string | string[]> = {};

    const res = events as unknown as ServerResponse;
    (
      res as unknown as {
        writeHead: (
          status: number,
          headers: Record<string, string | string[]>,
        ) => void;
      }
    ).writeHead = (status, headers) => {
      capturedStatus = status;
      capturedHeaders = headers;
    };
    (
      res as unknown as {
        write: (chunk: Uint8Array) => void;
      }
    ).write = () => undefined;
    (
      res as unknown as {
        end: () => void;
      }
    ).end = () => undefined;

    const response = new Response('ok', {
      status: 200,
      headers: [
        ['set-cookie', 'a=1'],
        ['set-cookie', 'b=2'],
      ],
    });

    await writeWebResponse(response, res);

    expect(capturedStatus).toBe(200);
    expect(capturedHeaders['set-cookie']).toEqual(['a=1', 'b=2']);
  });
});
