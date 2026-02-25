/**
 * @license
 * Copyright 2026 cofy-x
 * SPDX-License-Identifier: Apache-2.0
 */

import { randomUUID } from 'node:crypto';
import {
  chmod,
  copyFile,
  mkdir,
  mkdtemp,
  readdir,
  rename,
  rm,
  stat,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, dirname, join } from 'node:path';

import type {
  ResolvedBinary,
  SidecarConfig,
  SidecarName,
  SidecarTarget,
} from '../types/index.js';
import { fileExists } from '../utils/fs.js';
import { proxyFetch } from '../utils/fetch.js';
import { runCommand } from '../utils/process.js';
import { fetchRemoteManifest, resolveManifestCandidates } from './manifest.js';
import { readCliVersion, verifyBinary } from './version.js';

function resolveAssetUrl(
  baseUrl: string,
  asset?: string,
  url?: string,
): string | null {
  if (url && url.trim()) return url.trim();
  if (asset && asset.trim()) {
    return `${baseUrl.replace(/\/$/, '')}/${asset.trim()}`;
  }
  return null;
}

function resolveAssetName(asset?: string, url?: string): string | null {
  if (asset && asset.trim()) return asset.trim();
  if (url && url.trim()) {
    try {
      return basename(new URL(url).pathname);
    } catch {
      const parts = url.split('/').filter(Boolean);
      return parts.length ? (parts[parts.length - 1] ?? null) : null;
    }
  }
  return null;
}

export async function downloadToPath(url: string, dest: string): Promise<void> {
  let response: Awaited<ReturnType<typeof proxyFetch>>;
  try {
    response = await proxyFetch(url);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    throw new Error(`Failed to fetch ${url}: ${message}`, { cause: err });
  }
  if (!response.ok) {
    throw new Error(`Failed to download ${url} (HTTP ${response.status})`);
  }
  const buffer = Buffer.from(await response.arrayBuffer());
  await mkdir(dirname(dest), { recursive: true });
  const tmpPath = `${dest}.tmp-${randomUUID()}`;
  await writeFile(tmpPath, buffer);
  await rename(tmpPath, dest);
}

export async function ensureExecutable(path: string): Promise<void> {
  if (process.platform === 'win32') return;
  try {
    await chmod(path, 0o755);
  } catch {
    // ignore
  }
}

interface DownloadSidecarOptions {
  name: SidecarName;
  sidecar: SidecarConfig;
}

export async function downloadSidecarBinary(
  options: DownloadSidecarOptions,
): Promise<ResolvedBinary | null> {
  if (!options.sidecar.target) return null;
  const manifestCandidates = resolveManifestCandidates(options.sidecar);
  let manifest: Awaited<ReturnType<typeof fetchRemoteManifest>> = null;
  let manifestBase = options.sidecar.baseUrl;
  for (const candidate of manifestCandidates) {
    const resolved = await fetchRemoteManifest(candidate.manifestUrl);
    if (resolved) {
      manifest = resolved;
      manifestBase = candidate.baseUrl;
      break;
    }
  }
  if (!manifest) return null;
  const entry = manifest.entries[options.name];
  if (!entry) return null;
  const targetInfo = entry.targets[options.sidecar.target];
  if (!targetInfo) return null;

  const assetName = resolveAssetName(targetInfo.asset, targetInfo.url);
  const assetUrl = resolveAssetUrl(
    manifestBase,
    targetInfo.asset,
    targetInfo.url,
  );
  if (!assetName || !assetUrl) return null;

  const targetDir = join(
    options.sidecar.dir,
    entry.version,
    options.sidecar.target,
  );
  const targetPath = join(targetDir, assetName);
  if (await fileExists(targetPath)) {
    if (targetInfo.sha256) {
      try {
        await verifyBinary(targetPath, {
          version: entry.version,
          sha256: targetInfo.sha256,
        });
        await ensureExecutable(targetPath);
        return {
          bin: targetPath,
          source: 'downloaded',
          expectedVersion: entry.version,
        };
      } catch {
        await rm(targetPath, { force: true });
      }
    } else {
      await ensureExecutable(targetPath);
      return {
        bin: targetPath,
        source: 'downloaded',
        expectedVersion: entry.version,
      };
    }
  }

  await downloadToPath(assetUrl, targetPath);
  if (targetInfo.sha256) {
    await verifyBinary(targetPath, {
      version: entry.version,
      sha256: targetInfo.sha256,
    });
  }
  await ensureExecutable(targetPath);
  return {
    bin: targetPath,
    source: 'downloaded',
    expectedVersion: entry.version,
  };
}

function resolveOpencodeAsset(target: SidecarTarget): string | null {
  const assets: { [K in SidecarTarget]: string } = {
    'darwin-arm64': 'opencode-darwin-arm64.zip',
    'darwin-x64': 'opencode-darwin-x64-baseline.zip',
    'linux-x64': 'opencode-linux-x64-baseline.tar.gz',
    'linux-arm64': 'opencode-linux-arm64.tar.gz',
    'windows-x64': 'opencode-windows-x64-baseline.zip',
    'windows-arm64': 'opencode-windows-arm64.zip',
  };
  return assets[target] ?? null;
}

export async function resolveOpencodeDownload(
  sidecar: SidecarConfig,
  expectedVersion?: string,
): Promise<string> {
  if (!expectedVersion) {
    throw new Error(
      'opencode version not specified. Set opencodeVersion in package.json or OPENCODE_VERSION env var.',
    );
  }
  if (!sidecar.target) {
    throw new Error(
      `Unsupported platform/arch: ${process.platform}/${process.arch}`,
    );
  }

  const assetOverride =
    process.env['PILOT_OPENCODE_ASSET'] ?? process.env['OPENCODE_ASSET'];
  const asset = assetOverride?.trim() || resolveOpencodeAsset(sidecar.target);
  if (!asset) {
    throw new Error(
      `No opencode asset available for target: ${sidecar.target}`,
    );
  }

  const version = expectedVersion.startsWith('v')
    ? expectedVersion.slice(1)
    : expectedVersion;
  const url = `https://github.com/anomalyco/opencode/releases/download/v${version}/${asset}`;
  const targetDir = join(sidecar.dir, 'opencode', version, sidecar.target);
  const targetPath = join(
    targetDir,
    process.platform === 'win32' ? 'opencode.exe' : 'opencode',
  );

  if (await fileExists(targetPath)) {
    const actual = await readCliVersion(targetPath);
    if (actual === version) {
      await ensureExecutable(targetPath);
      return targetPath;
    }
  }

  await mkdir(targetDir, { recursive: true });
  const stamp = Date.now();
  const archivePath = join(tmpdir(), `pilot-opencode-${stamp}-${asset}`);
  const extractDir = await mkdtemp(join(tmpdir(), 'pilot-opencode-'));

  try {
    await downloadToPath(url, archivePath);
    if (process.platform === 'win32') {
      const psQuote = (value: string) => `'${value.replace(/'/g, "''")}'`;
      const psScript = [
        "$ErrorActionPreference = 'Stop'",
        `Expand-Archive -Path ${psQuote(archivePath)} -DestinationPath ${psQuote(extractDir)} -Force`,
      ].join('; ');
      await runCommand('powershell', ['-NoProfile', '-Command', psScript]);
    } else if (asset.endsWith('.zip')) {
      await runCommand('unzip', ['-q', archivePath, '-d', extractDir]);
    } else if (asset.endsWith('.tar.gz')) {
      await runCommand('tar', ['-xzf', archivePath, '-C', extractDir]);
    } else {
      throw new Error(`Unsupported opencode asset type: ${asset}`);
    }

    const entries = await readdir(extractDir, { withFileTypes: true });
    const queue = entries.map((entry) => join(extractDir, entry.name));
    let candidate: string | null = null;
    while (queue.length) {
      const current = queue.shift();
      if (!current) break;
      const statInfo = await stat(current);
      if (statInfo.isDirectory()) {
        const nested = await readdir(current, { withFileTypes: true });
        queue.push(...nested.map((entry) => join(current, entry.name)));
        continue;
      }
      const base = basename(current);
      if (base === 'opencode' || base === 'opencode.exe') {
        candidate = current;
        break;
      }
    }

    if (!candidate) {
      throw new Error('OpenCode binary not found after extraction.');
    }

    await copyFile(candidate, targetPath);
    await ensureExecutable(targetPath);
    return targetPath;
  } finally {
    await rm(extractDir, { recursive: true, force: true });
    await rm(archivePath, { force: true });
  }
}
