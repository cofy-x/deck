/**
 * @license
 * Copyright 2026 cofy-x
 * SPDX-License-Identifier: Apache-2.0
 */

import type { ApiErrorBody, JsonObject } from './types/index.js';

export class ApiError extends Error {
  status: number;
  code: string;
  details?: JsonObject;

  constructor(
    status: number,
    code: string,
    message: string,
    details?: JsonObject,
  ) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export function formatError(err: ApiError): ApiErrorBody {
  const output: ApiErrorBody = {
    code: err.code,
    message: err.message,
  };
  if (err.details !== undefined) {
    output.details = err.details;
  }
  return output;
}
