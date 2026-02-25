/**
 * @license
 * Copyright 2026 cofy-x
 * SPDX-License-Identifier: Apache-2.0
 */

const AUTH_ERROR_PATTERNS = [
  /\bunauthorized\b/i,
  /\binvalid opencode credentials\b/i,
  /\bhttp\s*401\b/i,
  /\bhttp\s*403\b/i,
  /\b401\b/,
  /\b403\b/,
];

export function isAuthConnectionErrorMessage(
  message: string | null | undefined,
): boolean {
  if (!message) return false;
  return AUTH_ERROR_PATTERNS.some((pattern) => pattern.test(message));
}

