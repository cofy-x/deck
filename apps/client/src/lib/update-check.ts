/**
 * @license
 * Copyright 2026 cofy-x
 * SPDX-License-Identifier: Apache-2.0
 *
 * Lightweight update checker that queries GitHub Releases API
 * and compares the latest published version against the running app version.
 */

import { fetch as tauriFetch } from '@tauri-apps/plugin-http';
import { getVersion } from '@tauri-apps/api/app';

import { isTauriRuntime } from './utils';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const GITHUB_RELEASES_API =
  'https://api.github.com/repos/cofy-x/deck/releases?per_page=1';

export const GITHUB_RELEASES_PAGE =
  'https://github.com/cofy-x/deck/releases';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ReleaseInfo {
  version: string;
  tagName: string;
  htmlUrl: string;
  body: string;
  publishedAt: string;
  prerelease: boolean;
}

export interface UpdateCheckResult {
  currentVersion: string;
  latestRelease: ReleaseInfo | null;
  hasUpdate: boolean;
}

// ---------------------------------------------------------------------------
// Semver comparison (supports pre-release suffixes)
// ---------------------------------------------------------------------------

interface ParsedVersion {
  major: number;
  minor: number;
  patch: number;
  prerelease: string[];
}

function parseVersion(raw: string): ParsedVersion {
  const cleaned = raw.replace(/^v/, '');
  const [coreStr, ...preParts] = cleaned.split('-');
  const parts = (coreStr ?? '').split('.').map(Number);
  const prerelease = preParts.length > 0 ? preParts.join('-').split('.') : [];

  return {
    major: parts[0] ?? 0,
    minor: parts[1] ?? 0,
    patch: parts[2] ?? 0,
    prerelease,
  };
}

/**
 * Compare two version strings. Returns:
 *  -1 if a < b
 *   0 if a == b
 *   1 if a > b
 *
 * Pre-release versions are lower than the same release version:
 *   0.0.1-alpha.1 < 0.0.1-alpha.2 < 0.0.1-beta.1 < 0.0.1
 */
export function compareVersions(a: string, b: string): -1 | 0 | 1 {
  const va = parseVersion(a);
  const vb = parseVersion(b);

  for (const field of ['major', 'minor', 'patch'] as const) {
    if (va[field] < vb[field]) return -1;
    if (va[field] > vb[field]) return 1;
  }

  if (va.prerelease.length === 0 && vb.prerelease.length === 0) return 0;
  if (va.prerelease.length === 0) return 1;
  if (vb.prerelease.length === 0) return -1;

  const len = Math.max(va.prerelease.length, vb.prerelease.length);
  for (let i = 0; i < len; i++) {
    const pa = va.prerelease[i];
    const pb = vb.prerelease[i];
    if (pa === undefined) return -1;
    if (pb === undefined) return 1;

    const na = Number(pa);
    const nb = Number(pb);
    const aIsNum = !isNaN(na);
    const bIsNum = !isNaN(nb);

    if (aIsNum && bIsNum) {
      if (na < nb) return -1;
      if (na > nb) return 1;
    } else {
      if (pa < pb) return -1;
      if (pa > pb) return 1;
    }
  }

  return 0;
}

// ---------------------------------------------------------------------------
// Fetch helpers
// ---------------------------------------------------------------------------

async function fetchGitHubReleases(): Promise<ReleaseInfo | null> {
  const doFetch = isTauriRuntime() ? tauriFetch : globalThis.fetch;

  const resp = await doFetch(GITHUB_RELEASES_API, {
    headers: {
      Accept: 'application/vnd.github+json',
      'User-Agent': 'deck-desktop-client',
    },
  });

  if (!resp.ok) return null;

  const releases: Array<{
    tag_name: string;
    html_url: string;
    body: string | null;
    published_at: string;
    prerelease: boolean;
    draft: boolean;
  }> = await resp.json();

  const release = releases.find((r) => !r.draft);
  if (!release) return null;

  return {
    version: release.tag_name.replace(/^v/, ''),
    tagName: release.tag_name,
    htmlUrl: release.html_url,
    body: release.body ?? '',
    publishedAt: release.published_at,
    prerelease: release.prerelease,
  };
}

async function getCurrentVersion(): Promise<string> {
  if (isTauriRuntime()) {
    return getVersion();
  }
  return '0.0.0-dev';
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export async function checkForUpdates(): Promise<UpdateCheckResult> {
  const [currentVersion, latestRelease] = await Promise.all([
    getCurrentVersion(),
    fetchGitHubReleases(),
  ]);

  const hasUpdate =
    latestRelease !== null &&
    compareVersions(currentVersion, latestRelease.version) === -1;

  return { currentVersion, latestRelease, hasUpdate };
}
