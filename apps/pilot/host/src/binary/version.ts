/**
 * @license
 * Copyright 2026 cofy-x
 * SPDX-License-Identifier: Apache-2.0
 */

import { readFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { z } from 'zod';

import type {
  SidecarName,
  SidecarVersionEntries,
  VersionInfo,
  VersionManifest,
} from '../types/index.js';
import {
  fileExists,
  isExecutable,
  readPackageField,
  readPackageVersion,
  sha256File,
} from '../utils/fs.js';
import { resolveBinCommand } from '../utils/process.js';

const versionInfoSchema = z.object({
  version: z.string(),
  sha256: z.string(),
});

const sidecarVersionEntriesSchema = z
  .object({
    'pilot-server': versionInfoSchema.optional(),
    bridge: versionInfoSchema.optional(),
    opencode: versionInfoSchema.optional(),
  })
  .partial();

function parseSidecarVersionEntries(input: unknown): SidecarVersionEntries {
  const parsed = sidecarVersionEntriesSchema.safeParse(input);
  if (!parsed.success) return {};
  return parsed.data as SidecarVersionEntries;
}

export async function readVersionManifest(): Promise<VersionManifest | null> {
  const candidates = [
    dirname(process.execPath),
    dirname(fileURLToPath(import.meta.url)),
  ];
  for (const dir of candidates) {
    const manifestPath = join(dir, 'versions.json');
    if (await fileExists(manifestPath)) {
      try {
        const payload = await readFile(manifestPath, 'utf8');
        const raw = JSON.parse(payload) as unknown;
        return { dir, entries: parseSidecarVersionEntries(raw) };
      } catch {
        return { dir, entries: {} };
      }
    }
  }
  return null;
}

export async function verifyBinary(
  path: string,
  expected?: VersionInfo,
): Promise<void> {
  if (!expected) return;
  const hash = await sha256File(path);
  if (hash !== expected.sha256) {
    throw new Error(`Integrity check failed for ${path}`);
  }
}

export async function resolveBundledBinary(
  manifest: VersionManifest | null,
  name: SidecarName,
): Promise<string | null> {
  if (!manifest) return null;
  const candidates = [join(manifest.dir, name)];
  if (process.platform === 'win32') {
    candidates.push(join(manifest.dir, `${name}.exe`));
  }
  for (const bundled of candidates) {
    if (!(await isExecutable(bundled))) continue;
    await verifyBinary(bundled, manifest.entries[name]);
    return bundled;
  }
  return null;
}

function parseVersion(output: string): string | undefined {
  const match = output.match(/\d+\.\d+\.\d+(?:-[\w.-]+)?/);
  return match?.[0];
}

export async function readCliVersion(
  bin: string,
  timeoutMs = 4000,
): Promise<string | undefined> {
  const resolved = resolveBinCommand(bin);
  const child = spawn(resolved.command, [...resolved.prefixArgs, '--version'], {
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let output = '';
  child.stdout?.on('data', (chunk: Buffer) => {
    output += chunk.toString();
  });
  child.stderr?.on('data', (chunk: Buffer) => {
    output += chunk.toString();
  });

  const result = await Promise.race([
    once(child, 'close').then(() => 'close'),
    once(child, 'error').then(() => 'error'),
    new Promise((resolve) => setTimeout(resolve, timeoutMs, 'timeout')),
  ]);

  if (result === 'timeout') {
    try {
      child.kill('SIGKILL');
    } catch {
      // ignore
    }
    return undefined;
  }

  if (result === 'error') {
    return undefined;
  }

  return parseVersion(output.trim());
}

export function assertVersionMatch(
  name: string,
  expected: string | undefined,
  actual: string | undefined,
  context: string,
): void {
  if (!expected) return;
  if (!actual) {
    throw new Error(
      `Unable to determine ${name} version from ${context}. Expected ${expected}.`,
    );
  }
  if (expected !== actual) {
    throw new Error(
      `${name} version mismatch: expected ${expected}, got ${actual}.`,
    );
  }
}

export async function resolveExpectedVersion(
  manifest: VersionManifest | null,
  name: SidecarName,
): Promise<string | undefined> {
  const manifestVersion = manifest?.entries[name]?.version;
  if (manifestVersion) return manifestVersion;

  try {
    const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
    if (name === 'pilot-server') {
      const localPath = join(root, '..', 'server', 'package.json');
      const localVersion = await readPackageVersion(localPath);
      if (localVersion) return localVersion;
    }
    if (name === 'bridge') {
      const localPath = join(root, '..', 'bridge', 'package.json');
      const localVersion = await readPackageVersion(localPath);
      if (localVersion) return localVersion;
    }
    if (name === 'opencode') {
      const envVersion = process.env['OPENCODE_VERSION']?.trim();
      if (envVersion)
        return envVersion.startsWith('v') ? envVersion.slice(1) : envVersion;
      const pkgVersion = await readPackageField('opencodeVersion');
      if (pkgVersion)
        return pkgVersion.startsWith('v') ? pkgVersion.slice(1) : pkgVersion;
    }
  } catch {
    // ignore
  }

  return undefined;
}
