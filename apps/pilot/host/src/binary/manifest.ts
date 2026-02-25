/**
 * @license
 * Copyright 2026 cofy-x
 * SPDX-License-Identifier: Apache-2.0
 */

import { z } from 'zod';

import type { RemoteSidecarManifest, SidecarConfig } from '../types/index.js';
import { proxyFetch } from '../utils/fetch.js';

const remoteManifestSuccessCache = new Map<string, RemoteSidecarManifest>();
const remoteManifestInflightCache = new Map<
  string,
  Promise<RemoteSidecarManifest | null>
>();
const remoteManifestFailedAt = new Map<string, number>();
const REMOTE_MANIFEST_FAILURE_BACKOFF_MS = 3_000;

const remoteSidecarAssetSchema = z.object({
  asset: z.string().optional(),
  url: z.string().optional(),
  sha256: z.string().optional(),
  size: z.number().int().positive().optional(),
});

const remoteSidecarEntrySchema = z.object({
  version: z.string(),
  targets: z.record(z.string(), remoteSidecarAssetSchema),
});

const remoteSidecarManifestSchema = z.object({
  version: z.string(),
  generatedAt: z.string().optional(),
  entries: z.record(z.string(), remoteSidecarEntrySchema),
});

function normalizeBaseUrl(url: string): string {
  return url.replace(/\/$/, '');
}

function manifestBaseUrl(manifestUrl: string): string {
  return manifestUrl.replace(/\/[^/]+$/, '');
}

export interface ManifestCandidate {
  manifestUrl: string;
  baseUrl: string;
}

export function resolveManifestCandidates(
  sidecar: SidecarConfig,
): ManifestCandidate[] {
  const primaryManifestUrl = sidecar.manifestUrl.trim();
  const primaryBaseUrl = normalizeBaseUrl(sidecar.baseUrl);
  const sameDir = manifestBaseUrl(primaryManifestUrl);
  const candidates: ManifestCandidate[] = [
    { manifestUrl: primaryManifestUrl, baseUrl: primaryBaseUrl },
  ];

  const pushCandidate = (manifestUrl: string): void => {
    const normalizedManifestUrl = manifestUrl.trim();
    const baseUrl = manifestBaseUrl(normalizedManifestUrl);
    if (
      !candidates.some(
        (entry) => entry.manifestUrl === normalizedManifestUrl,
      )
    ) {
      candidates.push({ manifestUrl: normalizedManifestUrl, baseUrl });
    }
  };

  if (primaryManifestUrl.endsWith('/pilot-host-sidecars.json')) {
    pushCandidate(`${sameDir}/pilot-sidecars.json`);
  } else if (primaryManifestUrl.endsWith('/pilot-sidecars.json')) {
    pushCandidate(`${sameDir}/pilot-host-sidecars.json`);
  }

  if (primaryManifestUrl.includes('/pilot-host-v')) {
    pushCandidate(
      primaryManifestUrl
        .replace('/pilot-host-v', '/pilot-v')
        .replace('/pilot-host-sidecars.json', '/pilot-sidecars.json'),
    );
  } else if (primaryManifestUrl.includes('/pilot-v')) {
    pushCandidate(
      primaryManifestUrl
        .replace('/pilot-v', '/pilot-host-v')
        .replace('/pilot-sidecars.json', '/pilot-host-sidecars.json'),
    );
  }

  if (primaryBaseUrl.includes('/pilot-host-v')) {
    const legacyBase = primaryBaseUrl.replace('/pilot-host-v', '/pilot-v');
    pushCandidate(`${legacyBase}/pilot-sidecars.json`);
  } else if (primaryBaseUrl.includes('/pilot-v')) {
    const modernBase = primaryBaseUrl.replace('/pilot-v', '/pilot-host-v');
    pushCandidate(`${modernBase}/pilot-host-sidecars.json`);
  }

  return candidates;
}

export async function fetchRemoteManifest(
  url: string,
): Promise<RemoteSidecarManifest | null> {
  const success = remoteManifestSuccessCache.get(url);
  if (success) return success;

  const failedAt = remoteManifestFailedAt.get(url);
  if (failedAt && Date.now() - failedAt < REMOTE_MANIFEST_FAILURE_BACKOFF_MS) {
    return null;
  }

  const inflight = remoteManifestInflightCache.get(url);
  if (inflight) return inflight;

  const task = (async () => {
    try {
      const response = await proxyFetch(url);
      if (!response.ok) return null;
      const raw = (await response.json()) as unknown;
      const parsed = remoteSidecarManifestSchema.safeParse(raw);
      if (!parsed.success) return null;
      return parsed.data as RemoteSidecarManifest;
    } catch {
      return null;
    }
  })();

  remoteManifestInflightCache.set(url, task);
  const resolved = await task;
  remoteManifestInflightCache.delete(url);

  if (resolved) {
    remoteManifestSuccessCache.set(url, resolved);
    remoteManifestFailedAt.delete(url);
    return resolved;
  }

  remoteManifestFailedAt.set(url, Date.now());
  return null;
}

export function clearRemoteManifestCacheForTesting(): void {
  remoteManifestSuccessCache.clear();
  remoteManifestInflightCache.clear();
  remoteManifestFailedAt.clear();
}

export async function fetchRemoteManifestForTesting(
  url: string,
): Promise<RemoteSidecarManifest | null> {
  return fetchRemoteManifest(url);
}
