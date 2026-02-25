/**
 * @license
 * Copyright 2026 cofy-x
 * SPDX-License-Identifier: Apache-2.0
 */
import { z } from 'zod';

// ---------------------------------------------------------------------------
// URL helpers
// ---------------------------------------------------------------------------

function parseHttpUrl(value: string): URL | null {
  try {
    const parsed = new URL(value.trim());
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function normalizeHttpUrl(value: string): string {
  const parsed = parseHttpUrl(value);
  if (!parsed) {
    throw new Error('URL must start with http:// or https://');
  }

  const normalizedPath = parsed.pathname.replace(/\/+$/, '');
  const path = normalizedPath === '' ? '' : normalizedPath;
  return `${parsed.origin}${path}${parsed.search}${parsed.hash}`;
}

export function normalizeOptionalHttpUrl(value: string): string | undefined {
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  return normalizeHttpUrl(trimmed);
}

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

const requiredHttpUrlSchema = z
  .string()
  .trim()
  .min(1, 'URL is required')
  .transform((value, ctx) => {
    try {
      return normalizeHttpUrl(value);
    } catch {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'URL must start with http:// or https://',
      });
      return z.NEVER;
    }
  });

const optionalHttpUrlSchema = z
  .string()
  .trim()
  .optional()
  .transform((value, ctx) => {
    if (!value) return undefined;
    try {
      return normalizeOptionalHttpUrl(value);
    } catch {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'URL must start with http:// or https://',
      });
      return z.NEVER;
    }
  });

export const remoteConnectionInputSchema = z.object({
  name: z.string().trim().min(1, 'Name is required'),
  opencodeBaseUrl: requiredHttpUrlSchema,
  daemonBaseUrl: optionalHttpUrlSchema,
  noVncUrl: optionalHttpUrlSchema,
  webTerminalUrl: optionalHttpUrlSchema,
});

export type RemoteConnectionInput = z.infer<typeof remoteConnectionInputSchema>;
