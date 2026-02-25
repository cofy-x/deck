/**
 * @license
 * Copyright 2026 cofy-x
 * SPDX-License-Identifier: Apache-2.0
 */

import { z } from 'zod';

import type { JsonObject, JsonValue } from './types/json.js';

const JsonValueSchema: z.ZodType<JsonValue> = z.lazy(() =>
  z.union([
    z.string(),
    z.number(),
    z.boolean(),
    z.null(),
    z.array(JsonValueSchema),
    z.record(z.string(), JsonValueSchema),
  ]),
);

const JsonObjectSchema: z.ZodType<JsonObject> = z.record(
  z.string(),
  JsonValueSchema,
);

function formatSchemaError(context: string, error: z.ZodError): string {
  const firstIssue = error.issues[0];
  if (!firstIssue) {
    return `Invalid JSON value for ${context}`;
  }
  const path = firstIssue.path.length > 0 ? firstIssue.path.join('.') : '$';
  return `Invalid JSON value for ${context} at ${path}: ${firstIssue.message}`;
}

export function parseJsonText(raw: string, context: string): unknown {
  try {
    return JSON.parse(raw);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Invalid JSON for ${context}: ${message}`);
  }
}

export function parseJsonTextWithSchema<T>(
  raw: string,
  schema: z.ZodType<T>,
  context: string,
): T {
  const parsed = parseJsonText(raw, context);
  return parseUnknownWithSchema(parsed, schema, context);
}

export function parseUnknownWithSchema<T>(
  value: unknown,
  schema: z.ZodType<T>,
  context: string,
): T {
  const result = schema.safeParse(value);
  if (!result.success) {
    throw new Error(formatSchemaError(context, result.error));
  }
  return result.data;
}

export function parseJsonValue(value: unknown, context: string): JsonValue {
  return parseUnknownWithSchema(value, JsonValueSchema, context);
}

export function parseJsonObject(value: unknown, context: string): JsonObject {
  return parseUnknownWithSchema(value, JsonObjectSchema, context);
}
