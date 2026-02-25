/**
 * @license
 * Copyright 2026 cofy-x
 * SPDX-License-Identifier: Apache-2.0
 */
import type {
  AssistantMessage,
  EventSessionError,
} from '@opencode-ai/sdk/v2/client';

export interface NormalizedSessionError {
  name: string;
  message: string;
}

const UNKNOWN_SESSION_ERROR_MESSAGE = 'An unknown error occurred';
const DEFAULT_SESSION_ERROR_MESSAGE = 'An error occurred during the session';

export const UNSUPPORTED_ATTACHMENT_ERROR_NAME = 'Unsupported Attachment';
export const UNSUPPORTED_ATTACHMENT_ERROR_MESSAGE =
  'Current model does not support this attachment type. Switch to a file-capable model/provider, or start a new session and send text content only.';

export function isUnsupportedMediaTypeMessage(message: string): boolean {
  const text = message.toLowerCase();
  return (
    text.includes('ai_unsupportedfunctionalityerror') &&
    text.includes('media type') &&
    text.includes('functionality not supported')
  );
}

export function normalizeSessionError(
  name: string,
  message: string,
): NormalizedSessionError {
  if (isUnsupportedMediaTypeMessage(message)) {
    return {
      name: UNSUPPORTED_ATTACHMENT_ERROR_NAME,
      message: UNSUPPORTED_ATTACHMENT_ERROR_MESSAGE,
    };
  }
  return { name, message };
}

type AssistantError = NonNullable<AssistantMessage['error']>;

function getSessionErrorMessage(error: AssistantError): string {
  switch (error.name) {
    case 'ProviderAuthError':
    case 'UnknownError':
    case 'MessageAbortedError':
    case 'APIError':
      return error.data.message;
    case 'MessageOutputLengthError':
      return error.name;
    default:
      return DEFAULT_SESSION_ERROR_MESSAGE;
  }
}

export function getAssistantErrorMessage(error: AssistantError): string {
  return getSessionErrorMessage(error);
}

export function getOptionalAssistantErrorMessage(
  error: AssistantMessage['error'],
): string | null {
  if (!error) return null;
  return getAssistantErrorMessage(error);
}

export function normalizeAssistantError(
  error: AssistantError,
): NormalizedSessionError {
  return normalizeSessionError(error.name, getAssistantErrorMessage(error));
}

export function normalizeEventSessionError(
  error: EventSessionError['properties']['error'],
): NormalizedSessionError {
  if (!error) {
    return {
      name: 'UnknownError',
      message: UNKNOWN_SESSION_ERROR_MESSAGE,
    };
  }
  return normalizeSessionError(error.name, getSessionErrorMessage(error));
}
