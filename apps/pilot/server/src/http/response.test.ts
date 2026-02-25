/**
 * @license
 * Copyright 2026 cofy-x
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, expect, test } from 'vitest';
import { z } from 'zod';
import type { ApiError } from '../errors.js';
import { readAndValidateJsonBody } from './response.js';

describe('readAndValidateJsonBody', () => {
  test('returns parsed payload for valid schema', async () => {
    const schema = z.object({ name: z.string().min(1) });
    const request = new Request('http://localhost/test', {
      method: 'POST',
      body: JSON.stringify({ name: 'pilot' }),
      headers: { 'content-type': 'application/json' },
    });

    const parsed = await readAndValidateJsonBody(request, schema);
    expect(parsed.name).toBe('pilot');
  });

  test('throws 422 for schema mismatch', async () => {
    const schema = z.object({ name: z.string().min(1) });
    const request = new Request('http://localhost/test', {
      method: 'POST',
      body: JSON.stringify({ name: '' }),
      headers: { 'content-type': 'application/json' },
    });

    await expect(readAndValidateJsonBody(request, schema)).rejects.toMatchObject({
      status: 422,
      code: 'invalid_payload',
    } satisfies Partial<ApiError>);
  });

  test('throws 400 for invalid json payload', async () => {
    const schema = z.object({ name: z.string().min(1) });
    const request = new Request('http://localhost/test', {
      method: 'POST',
      body: '{',
      headers: { 'content-type': 'application/json' },
    });

    await expect(readAndValidateJsonBody(request, schema)).rejects.toMatchObject({
      status: 400,
      code: 'invalid_json',
    } satisfies Partial<ApiError>);
  });
});
