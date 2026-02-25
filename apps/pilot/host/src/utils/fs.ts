/**
 * @license
 * Copyright 2026 cofy-x
 * SPDX-License-Identifier: Apache-2.0
 */

import { constants as fsConstants } from 'node:fs';
import { access, mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const FALLBACK_VERSION = '0.1.0';

// ---------------------------------------------------------------------------
// File system helpers
// ---------------------------------------------------------------------------

export async function fileExists(path: string): Promise<boolean> {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}

export async function isExecutable(path: string): Promise<boolean> {
  try {
    if (process.platform === 'win32') {
      await access(path, fsConstants.F_OK);
    } else {
      await access(path, fsConstants.X_OK);
    }
    return true;
  } catch {
    return false;
  }
}

export async function sha256File(path: string): Promise<string> {
  const data = await readFile(path);
  return createHash('sha256').update(data).digest('hex');
}

export async function ensureWorkspace(workspace: string): Promise<string> {
  const resolved = resolve(workspace);
  await mkdir(resolved, { recursive: true });

  const configPath = join(resolved, 'opencode.json');
  if (!(await fileExists(configPath))) {
    const payload = JSON.stringify(
      { $schema: 'https://opencode.ai/config.json' },
      null,
      2,
    );
    await writeFile(configPath, `${payload}\n`, 'utf8');
  }

  return resolved;
}

// ---------------------------------------------------------------------------
// Package JSON helpers
// ---------------------------------------------------------------------------

interface PackageJsonData {
  version?: string;
  opencodeVersion?: string;
}

export async function resolveCliVersion(): Promise<string> {
  const candidates = [
    join(dirname(process.execPath), '..', 'package.json'),
    join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'package.json'),
  ];

  for (const candidate of candidates) {
    if (await fileExists(candidate)) {
      try {
        const raw = await readFile(candidate, 'utf8');
        const parsed = JSON.parse(raw) as PackageJsonData;
        if (typeof parsed.version === 'string') return parsed.version;
      } catch {
        // ignore
      }
    }
  }

  return FALLBACK_VERSION;
}

export async function readPackageField(
  field: keyof PackageJsonData,
): Promise<string | undefined> {
  const candidates = [
    join(dirname(process.execPath), '..', 'package.json'),
    join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'package.json'),
  ];

  for (const candidate of candidates) {
    if (await fileExists(candidate)) {
      try {
        const raw = await readFile(candidate, 'utf8');
        const parsed = JSON.parse(raw) as PackageJsonData;
        const value = parsed[field];
        if (typeof value === 'string' && value.trim()) return value.trim();
      } catch {
        // ignore
      }
    }
  }

  return undefined;
}

export async function readPackageVersion(
  path: string,
): Promise<string | undefined> {
  try {
    const payload = await readFile(path, 'utf8');
    const parsed = JSON.parse(payload) as PackageJsonData;
    if (typeof parsed.version === 'string') return parsed.version;
    return undefined;
  } catch {
    return undefined;
  }
}
