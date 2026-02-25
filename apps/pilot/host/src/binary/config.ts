/**
 * @license
 * Copyright 2026 cofy-x
 * SPDX-License-Identifier: Apache-2.0
 */

import { homedir } from 'node:os';
import { join, resolve } from 'node:path';

import { readFlag } from '../args.js';
import type { FlagMap, SidecarConfig, SidecarTarget } from '../types/index.js';

export function resolveRouterDataDir(flags: FlagMap): string {
  const override = readFlag(flags, 'data-dir') ?? process.env['PILOT_DATA_DIR'];
  if (override && override.trim()) {
    return resolve(override.trim());
  }
  return join(homedir(), '.deck', 'pilot', 'host');
}

function resolveSidecarDir(flags: FlagMap): string {
  const override =
    readFlag(flags, 'sidecar-dir') ?? process.env['PILOT_SIDECAR_DIR'];
  if (override && override.trim()) return resolve(override.trim());
  return join(resolveRouterDataDir(flags), 'sidecars');
}

function resolveSidecarBaseUrl(flags: FlagMap, cliVersion: string): string {
  const override =
    readFlag(flags, 'sidecar-base-url') ??
    process.env['PILOT_SIDECAR_BASE_URL'];
  if (override && override.trim()) return override.trim();
  return `https://github.com/cofy-x/deck/releases/download/pilot-host-v${cliVersion}`;
}

function resolveSidecarManifestUrl(flags: FlagMap, baseUrl: string): string {
  const override =
    readFlag(flags, 'sidecar-manifest') ??
    process.env['PILOT_SIDECAR_MANIFEST_URL'];
  if (override && override.trim()) return override.trim();
  return `${baseUrl.replace(/\/$/, '')}/pilot-host-sidecars.json`;
}

export function resolveSidecarTarget(): SidecarTarget | null {
  if (process.platform === 'darwin') {
    if (process.arch === 'arm64') return 'darwin-arm64';
    if (process.arch === 'x64') return 'darwin-x64';
    return null;
  }
  if (process.platform === 'linux') {
    if (process.arch === 'arm64') return 'linux-arm64';
    if (process.arch === 'x64') return 'linux-x64';
    return null;
  }
  if (process.platform === 'win32') {
    if (process.arch === 'arm64') return 'windows-arm64';
    if (process.arch === 'x64') return 'windows-x64';
    return null;
  }
  return null;
}

export function resolveSidecarConfig(
  flags: FlagMap,
  cliVersion: string,
): SidecarConfig {
  const baseUrl = resolveSidecarBaseUrl(flags, cliVersion);
  return {
    dir: resolveSidecarDir(flags),
    baseUrl,
    manifestUrl: resolveSidecarManifestUrl(flags, baseUrl),
    target: resolveSidecarTarget(),
  };
}
