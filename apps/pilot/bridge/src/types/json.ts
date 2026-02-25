/**
 * @license
 * Copyright 2025 cofy-x
 * SPDX-License-Identifier: Apache-2.0
 */

// ---------------------------------------------------------------------------
// JSON utility types
// ---------------------------------------------------------------------------

export type JsonPrimitive = string | number | boolean | null | undefined;

export interface JsonObject {
  [key: string]: JsonValue;
}

export type JsonArray = JsonValue[];

export type JsonValue = JsonPrimitive | JsonObject | JsonArray;
