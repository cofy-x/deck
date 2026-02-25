/**
 * @license
 * Copyright 2026 cofy-x
 * SPDX-License-Identifier: Apache-2.0
 */

import { mkdir, readFile, stat } from 'node:fs/promises';

export async function exists(path: string): Promise<boolean> {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}

export async function ensureDir(path: string): Promise<void> {
  await mkdir(path, { recursive: true });
}

export async function readJsonFile<T>(path: string): Promise<T | null> {
  try {
    const raw = await readFile(path, 'utf8');
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export type JsonReadStatus = 'ok' | 'missing' | 'invalid';

export interface ReadJsonFileWithStatusResult<T> {
  status: JsonReadStatus;
  data?: T;
  raw?: string;
  error?: string;
}

export async function readJsonFileWithStatus<T>(
  path: string,
): Promise<ReadJsonFileWithStatusResult<T>> {
  try {
    const raw = await readFile(path, 'utf8');
    try {
      const data = JSON.parse(raw) as T;
      return { status: 'ok', data, raw };
    } catch (error) {
      const message =
        error instanceof Error ? error.message : String(error);
      return { status: 'invalid', raw, error: message };
    }
  } catch (error) {
    const code =
      error instanceof Error && 'code' in error
        ? String((error as NodeJS.ErrnoException).code)
        : '';
    if (code === 'ENOENT') {
      return { status: 'missing' };
    }
    throw error;
  }
}
