/**
 * @license
 * Copyright 2025 cofy-x
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, expect, test } from 'vitest';

import type { PromptResponse } from '../../types/index.js';
import {
  buildOpencodeErrorMessage,
  extractPromptResponseError,
  isSessionNotFoundError,
  normalizeOpencodeError,
  type NormalizedOpencodeError,
} from './opencode-errors.js';

function createPromptResponse(
  error?: PromptResponse['info']['error'],
): PromptResponse {
  return {
    info: {
      id: 'msg_assistant',
      sessionID: 'ses_1',
      role: 'assistant',
      time: { created: Date.now() },
      parentID: 'msg_parent',
      modelID: 'gpt-5',
      providerID: 'openai',
      mode: 'chat',
      agent: 'assistant',
      path: {
        cwd: '/tmp',
        root: '/tmp',
      },
      cost: 0,
      tokens: {
        input: 0,
        output: 0,
        reasoning: 0,
        cache: {
          read: 0,
          write: 0,
        },
      },
      ...(error ? { error } : {}),
    },
    parts: [],
  };
}

describe('normalizeOpencodeError', () => {
  test('extracts message from Error cause when message is empty', () => {
    const error = new Error('');
    Object.defineProperty(error, 'cause', {
      value: { message: 'cause message' },
      configurable: true,
    });

    const normalized = normalizeOpencodeError(error);

    expect(normalized?.message).toBe('cause message');
    expect(normalized?.raw).toBe(error);
  });

  test('normalizes string input', () => {
    const normalized = normalizeOpencodeError('  network down  ');
    expect(normalized).toEqual({
      message: 'network down',
      raw: '  network down  ',
    });
  });

  test('normalizes object with name/message/statusCode/code', () => {
    const normalized = normalizeOpencodeError({
      name: 'APIError',
      message: 'Request failed',
      statusCode: 429,
      code: 'RATE_LIMIT',
    });

    expect(normalized).toEqual({
      name: 'APIError',
      message: 'Request failed',
      status: 429,
      code: 'RATE_LIMIT',
      raw: {
        name: 'APIError',
        message: 'Request failed',
        statusCode: 429,
        code: 'RATE_LIMIT',
      },
    });
  });

  test('extracts message from nested data.message', () => {
    const normalized = normalizeOpencodeError({
      name: 'NotFoundError',
      data: { message: 'session not found' },
    });

    expect(normalized).toEqual({
      name: 'NotFoundError',
      message: 'session not found',
      status: undefined,
      code: undefined,
      raw: {
        name: 'NotFoundError',
        data: { message: 'session not found' },
      },
    });
  });
});

describe('extractPromptResponseError', () => {
  test('returns null when response has no info.error', () => {
    const response = createPromptResponse();
    expect(extractPromptResponseError(response)).toBeNull();
  });

  test('extracts APIError message and statusCode from SDK error shape', () => {
    const response = createPromptResponse({
      name: 'APIError',
      data: {
        message: 'Too many requests',
        statusCode: 429,
        isRetryable: true,
      },
    });

    const normalized = extractPromptResponseError(response);
    expect(normalized).toEqual({
      name: 'APIError',
      message: 'Too many requests',
      status: 429,
      raw: response.info.error,
    });
  });

  test('extracts UnknownError message from SDK error shape', () => {
    const response = createPromptResponse({
      name: 'UnknownError',
      data: { message: 'Unexpected' },
    });

    const normalized = extractPromptResponseError(response);
    expect(normalized?.name).toBe('UnknownError');
    expect(normalized?.message).toBe('Unexpected');
  });

  test('falls back to generic unknown response error text', () => {
    const response = createPromptResponse();
    Object.defineProperty(response.info, 'error', {
      value: [],
      configurable: true,
      writable: true,
    });

    const normalized = extractPromptResponseError(response as PromptResponse);
    expect(normalized).toEqual({
      message: 'Unknown OpenCode response error',
      raw: response.info.error,
    });
  });
});

describe('isSessionNotFoundError', () => {
  test('matches session-related not found via path/message', () => {
    const error: NormalizedOpencodeError = {
      message: 'GET /storage/session/ses_1 not found',
      status: 404,
      raw: {},
    };
    expect(isSessionNotFoundError(error)).toBe(true);
  });

  test('matches when message includes session id', () => {
    const error: NormalizedOpencodeError = {
      message: 'resource not found: ses_abc',
      status: 404,
      raw: {},
    };
    expect(isSessionNotFoundError(error, 'ses_abc')).toBe(true);
  });

  test('does not match generic endpoint 404', () => {
    const error: NormalizedOpencodeError = {
      name: 'NotFoundError',
      message: 'project not found',
      status: 404,
      raw: {},
    };
    expect(isSessionNotFoundError(error)).toBe(false);
  });
});

describe('buildOpencodeErrorMessage', () => {
  test('maps session-not-found to reset guidance', () => {
    const message = buildOpencodeErrorMessage({
      name: 'NotFoundError',
      message: 'session not found: /storage/session/ses_1',
      statusCode: 404,
    });
    expect(message).toBe(
      'Error: OpenCode session expired and could not recover. Send /reset and try again.',
    );
  });

  test('maps auth and rate-limit errors', () => {
    expect(
      buildOpencodeErrorMessage({
        message: 'unauthorized',
        statusCode: 401,
      }),
    ).toBe('Error: OpenCode authentication failed (401). Check credentials.');
    expect(
      buildOpencodeErrorMessage({
        message: 'rate limit exceeded',
        statusCode: 429,
      }),
    ).toBe('Error: Rate limited. Please wait and try again.');
  });

  test('maps model/provider and connection errors', () => {
    expect(
      buildOpencodeErrorMessage({
        message: 'provider model unavailable',
      }),
    ).toBe('Error: Model/provider issue - provider model unavailable');
    expect(
      buildOpencodeErrorMessage({
        message: 'ECONNREFUSED 127.0.0.1:4096',
      }),
    ).toBe('Error: Cannot connect to OpenCode. Is it running?');
  });

  test('falls back to trimmed generic error text', () => {
    expect(buildOpencodeErrorMessage('  something bad happened  ')).toBe(
      'Error: something bad happened',
    );
  });
});
