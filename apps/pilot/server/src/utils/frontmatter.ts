/**
 * @license
 * Copyright 2026 cofy-x
 * SPDX-License-Identifier: Apache-2.0
 */

import { parse, stringify } from 'yaml';
import type { JsonObject } from '../types/index.js';

export function parseFrontmatter(content: string): {
  data: JsonObject;
  body: string;
} {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
  if (!match) {
    return { data: {}, body: content };
  }
  const raw = match[1] ?? '';
  const data = (parse(raw) as JsonObject) ?? {};
  const body = content.slice(match[0].length);
  return { data, body };
}

export function buildFrontmatter(data: JsonObject): string {
  const yaml = stringify(data).trimEnd();
  return `---\n${yaml}\n---\n`;
}
