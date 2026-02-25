/**
 * @license
 * Copyright 2025 cofy-x
 * SPDX-License-Identifier: Apache-2.0
 */

import type { PromptResponse } from '../../types/index.js';

export interface NormalizedOpencodeError {
  name?: string;
  message: string;
  status?: number;
  code?: string;
  raw: unknown;
}

type PromptInfoError = NonNullable<PromptResponse['info']['error']>;

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function asString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value : undefined;
}

function asNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function normalizePromptInfoError(
  error: PromptInfoError,
): NormalizedOpencodeError | null {
  switch (error.name) {
    case 'APIError':
      return {
        name: error.name,
        message: error.data.message || 'Unknown error',
        status: error.data.statusCode,
        raw: error,
      };
    case 'ProviderAuthError':
    case 'UnknownError':
    case 'MessageAbortedError':
      return {
        name: error.name,
        message: error.data.message || 'Unknown error',
        raw: error,
      };
    case 'MessageOutputLengthError':
      return normalizeOpencodeError(error);
    default:
      return normalizeOpencodeError(error);
  }
}

export function normalizeOpencodeError(
  error: unknown,
): NormalizedOpencodeError | null {
  if (error instanceof Error) {
    const objectError = asRecord(error);
    const cause = objectError ? asRecord(objectError['cause']) : null;
    const causeMessage = cause ? asString(cause['message']) : undefined;
    const message = error.message.trim() || causeMessage || 'Unknown error';
    const status =
      (objectError ? asNumber(objectError['status']) : undefined) ??
      (objectError ? asNumber(objectError['statusCode']) : undefined);
    const code = objectError ? asString(objectError['code']) : undefined;
    return {
      name: error.name || undefined,
      message,
      status,
      code,
      raw: error,
    };
  }

  if (typeof error === 'string') {
    const message = error.trim();
    if (!message) return null;
    return { message, raw: error };
  }

  const record = asRecord(error);
  if (!record) return null;

  const data = asRecord(record['data']);
  const message =
    asString(record['message']) ??
    (data ? asString(data['message']) : undefined) ??
    'Unknown error';
  const status =
    asNumber(record['status']) ??
    asNumber(record['statusCode']) ??
    (data ? asNumber(data['statusCode']) : undefined);
  const code = asString(record['code']);
  const name = asString(record['name']);

  return { name, message, status, code, raw: error };
}

export function extractPromptResponseError(
  response: PromptResponse,
): NormalizedOpencodeError | null {
  const responseError = response.info?.error;
  if (!responseError) return null;
  return (
    normalizePromptInfoError(responseError) ??
    normalizeOpencodeError(responseError) ?? {
      message: 'Unknown OpenCode response error',
      raw: responseError,
    }
  );
}

export function isSessionNotFoundError(
  error: NormalizedOpencodeError,
  sessionID?: string,
): boolean {
  const name = (error.name ?? '').toLowerCase();
  const message = error.message.toLowerCase();
  const status = error.status;

  const notFound =
    status === 404 ||
    name.includes('notfound') ||
    message.includes('not found') ||
    message.includes('resource not found');
  if (!notFound) return false;

  if (
    message.includes('/storage/session/') ||
    message.includes('session not found') ||
    message.includes('enoent')
  ) {
    return true;
  }

  if (sessionID && message.includes(sessionID.toLowerCase())) {
    return true;
  }

  return false;
}

export function buildOpencodeErrorMessage(error: unknown): string {
  const normalized = normalizeOpencodeError(error);
  if (!normalized) return 'Error: failed to reach OpenCode.';

  const msg = normalized.message;
  const lower = msg.toLowerCase();
  const status = normalized.status;

  if (isSessionNotFoundError(normalized)) {
    return 'Error: OpenCode session expired and could not recover. Send /reset and try again.';
  }
  if (status === 401 || lower.includes('401') || lower.includes('unauthorized')) {
    return 'Error: OpenCode authentication failed (401). Check credentials.';
  }
  if (status === 403 || lower.includes('403') || lower.includes('forbidden')) {
    return 'Error: OpenCode access forbidden (403).';
  }
  if (status === 404 || lower.includes('404') || lower.includes('not found')) {
    return 'Error: OpenCode endpoint not found (404).';
  }
  if (status === 429 || lower.includes('429') || lower.includes('rate limit')) {
    return 'Error: Rate limited. Please wait and try again.';
  }
  if (
    status === 500 ||
    lower.includes('500') ||
    lower.includes('internal server')
  ) {
    return 'Error: OpenCode server error (500).';
  }
  if (lower.includes('model') || lower.includes('provider')) {
    return `Error: Model/provider issue - ${msg.slice(0, 100)}`;
  }
  if (lower.includes('econnrefused') || lower.includes('connection')) {
    return 'Error: Cannot connect to OpenCode. Is it running?';
  }
  return msg.trim()
    ? `Error: ${msg.slice(0, 150)}`
    : 'Error: failed to reach OpenCode.';
}
