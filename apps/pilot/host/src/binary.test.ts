/**
 * @license
 * Copyright 2026 cofy-x
 * SPDX-License-Identifier: Apache-2.0
 */

import { afterEach, describe, expect, test, vi } from 'vitest';

const fsUtilsMock = vi.hoisted(() => ({
  fileExists: vi.fn<(path: string) => Promise<boolean>>(async () => false),
  isExecutable: vi.fn<(path: string) => Promise<boolean>>(async () => false),
  readPackageField: vi.fn(async () => undefined),
  readPackageVersion: vi.fn(async () => undefined),
  sha256File: vi.fn(async () => 'sha'),
}));

const proxyFetchMock = vi.hoisted(() =>
  vi.fn<(...args: Parameters<typeof fetch>) => ReturnType<typeof fetch>>(),
);

vi.mock('./utils/fs.js', () => fsUtilsMock);

vi.mock('./utils/fetch.js', () => ({
  proxyFetch: proxyFetchMock,
}));

import {
  clearRemoteManifestCacheForTesting,
  fetchRemoteManifestForTesting,
  resolveBridgeBin,
  resolveManifestCandidates,
  resolvePilotServerBin,
} from './binary.js';
import type { SidecarConfig } from './types/index.js';

describe('binary manifest resolution', () => {
  afterEach(() => {
    clearRemoteManifestCacheForTesting();
    proxyFetchMock.mockReset();
    fsUtilsMock.fileExists.mockReset();
    fsUtilsMock.isExecutable.mockReset();
    fsUtilsMock.readPackageField.mockReset();
    fsUtilsMock.readPackageVersion.mockReset();
    fsUtilsMock.sha256File.mockReset();
    fsUtilsMock.fileExists.mockResolvedValue(false);
    fsUtilsMock.isExecutable.mockResolvedValue(false);
    fsUtilsMock.readPackageField.mockResolvedValue(undefined);
    fsUtilsMock.readPackageVersion.mockResolvedValue(undefined);
    fsUtilsMock.sha256File.mockResolvedValue('sha');
    vi.useRealTimers();
  });

  test('resolves modern and legacy manifest candidates', () => {
    const sidecar: SidecarConfig = {
      dir: '/tmp/pilot-sidecars',
      baseUrl: 'https://example.test/releases/pilot-host-v1.2.3',
      manifestUrl:
        'https://example.test/releases/pilot-host-v1.2.3/pilot-host-sidecars.json',
      target: 'darwin-arm64',
    };

    const urls = resolveManifestCandidates(sidecar).map(
      (entry) => entry.manifestUrl,
    );
    expect(urls[0]).toBe(
      'https://example.test/releases/pilot-host-v1.2.3/pilot-host-sidecars.json',
    );
    expect(urls).toContain(
      'https://example.test/releases/pilot-v1.2.3/pilot-sidecars.json',
    );
  });

  test('retries manifest fetch after backoff when previous attempt failed', async () => {
    vi.useFakeTimers();
    proxyFetchMock
      .mockResolvedValueOnce(
        new Response('service unavailable', {
          status: 503,
          headers: { 'Content-Type': 'text/plain' },
        }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ version: '1', entries: {} }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      );

    const url = 'https://example.test/pilot-host-sidecars.json';
    const first = await fetchRemoteManifestForTesting(url);
    expect(first).toBeNull();
    expect(proxyFetchMock).toHaveBeenCalledTimes(1);

    const immediateRetry = await fetchRemoteManifestForTesting(url);
    expect(immediateRetry).toBeNull();
    expect(proxyFetchMock).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(3_200);
    const retry = await fetchRemoteManifestForTesting(url);
    expect(retry?.version).toBe('1');
    expect(proxyFetchMock).toHaveBeenCalledTimes(2);
  });

  test('prefers workspace pilot-server binary in auto mode without allow-external', async () => {
    fsUtilsMock.isExecutable.mockImplementation(async (path: string) =>
      path.includes('node_modules/.bin/pilot-server'),
    );
    const sidecar: SidecarConfig = {
      dir: '/tmp/pilot-sidecars',
      baseUrl: 'https://example.test/releases/pilot-host-v1.2.3',
      manifestUrl:
        'https://example.test/releases/pilot-host-v1.2.3/pilot-host-sidecars.json',
      target: 'darwin-arm64',
    };

    const resolved = await resolvePilotServerBin({
      explicit: undefined,
      manifest: null,
      allowExternal: false,
      sidecar,
      source: 'auto',
    });

    expect(resolved.source).toBe('external');
    expect(resolved.bin).toContain('node_modules/.bin/pilot-server');
    expect(proxyFetchMock).not.toHaveBeenCalled();
  });

  test('prefers workspace bridge binary in auto mode without allow-external', async () => {
    fsUtilsMock.isExecutable.mockImplementation(async (path: string) =>
      path.includes('node_modules/.bin/pilot-bridge'),
    );
    const sidecar: SidecarConfig = {
      dir: '/tmp/pilot-sidecars',
      baseUrl: 'https://example.test/releases/pilot-host-v1.2.3',
      manifestUrl:
        'https://example.test/releases/pilot-host-v1.2.3/pilot-host-sidecars.json',
      target: 'darwin-arm64',
    };

    const resolved = await resolveBridgeBin({
      explicit: undefined,
      manifest: null,
      allowExternal: false,
      sidecar,
      source: 'auto',
    });

    expect(resolved.source).toBe('external');
    expect(resolved.bin).toContain('node_modules/.bin/pilot-bridge');
    expect(proxyFetchMock).not.toHaveBeenCalled();
  });
});
