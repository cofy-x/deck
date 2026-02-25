/**
 * @license
 * Copyright 2026 cofy-x
 * SPDX-License-Identifier: Apache-2.0
 */

import type { ApprovalRequest, JsonObject, JsonValue } from '../types/index.js';
import { ApiError } from '../errors.js';
import type { RequestContext } from './router.js';
import type { ZodType } from 'zod';
import type { ZodError } from 'zod';
import { jsonObjectSchema } from '../schemas/common.js';

export function jsonResponse(data: JsonValue | object, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function formatValidationIssues(error: ZodError): JsonObject[] {
  return error.issues.map((issue) => ({
    code: issue.code,
    path: issue.path.map((segment) => String(segment)).join('.'),
    message: issue.message,
  }));
}

export function validateWithSchema<T>(
  schema: ZodType<T>,
  value: unknown,
  code = 'invalid_payload',
  message = 'Invalid request payload',
): T {
  const result = schema.safeParse(value);
  if (result.success) return result.data;
  throw new ApiError(422, code, message, {
    issues: formatValidationIssues(result.error),
  });
}

export function searchParamsToRecord(
  searchParams: URLSearchParams,
): Record<string, string> {
  const output: Record<string, string> = {};
  searchParams.forEach((value, key) => {
    output[key] = value;
  });
  return output;
}

export async function readAndValidateJsonBody<T>(
  request: Request,
  schema: ZodType<T>,
): Promise<T> {
  try {
    const json = (await request.json()) as unknown;
    return validateWithSchema(schema, json);
  } catch (error: unknown) {
    if (error instanceof ApiError) throw error;
    throw new ApiError(400, 'invalid_json', 'Invalid JSON body');
  }
}

export async function readJsonBody(request: Request): Promise<JsonObject> {
  return readAndValidateJsonBody(request, jsonObjectSchema);
}

export async function requireApproval(
  ctx: RequestContext,
  input: Omit<ApprovalRequest, 'id' | 'createdAt' | 'actor'>,
): Promise<void> {
  const actor = ctx.actor ?? { type: 'remote' as const };
  const result = await ctx.approvals.requestApproval({ ...input, actor });
  if (!result.allowed) {
    const details: JsonObject = { requestId: result.id };
    if (result.reason !== undefined) {
      details['reason'] = result.reason;
    }
    throw new ApiError(403, 'write_denied', 'Write request denied', {
      ...details,
    });
  }
}
