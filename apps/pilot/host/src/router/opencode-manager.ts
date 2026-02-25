/**
 * @license
 * Copyright 2026 cofy-x
 * SPDX-License-Identifier: Apache-2.0
 */

import type { ChildProcess } from 'node:child_process';

import {
  createOpencodeSdkClient,
  type OpencodeClient,
  startOpencode,
  verifyOpencodeVersion,
  waitForOpencodeHealthy,
} from '../services.js';
import type {
  BinarySourcePreference,
  HttpHeaders,
  LogFormat,
  Logger,
  ResolvedBinary,
  RouterState,
  SidecarConfig,
} from '../types/index.js';
import { sleep } from '../utils/poll.js';
import { isProcessAlive, nowMs, stopChild } from '../utils/process.js';
import { saveRouterState } from './state-store.js';

interface RouterOpencodeManagerOptions {
  state: RouterState;
  statePath: string;
  opencodeBinary: ResolvedBinary;
  resolvedWorkdir: string;
  opencodeHost: string;
  opencodePort: number;
  opencodeUsername?: string;
  opencodePassword?: string;
  authHeaders?: HttpHeaders;
  corsOrigins: string[];
  logger: Logger;
  logVerbose: (message: string) => void;
  runId: string;
  logFormat: LogFormat;
  cliVersion: string;
  sidecar: SidecarConfig;
  sidecarSource: BinarySourcePreference;
  opencodeSource: BinarySourcePreference;
  allowExternal: boolean;
}

export interface RouterOpencodeManager {
  ensureOpencode: () => Promise<{ baseUrl: string; client: OpencodeClient }>;
  shutdown: () => Promise<void>;
  getChild: () => ChildProcess | null;
}

async function stopProcessByPid(pid: number, timeoutMs = 2_500): Promise<void> {
  if (!isProcessAlive(pid)) return;
  try {
    process.kill(pid, 'SIGTERM');
  } catch {
    return;
  }
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (!isProcessAlive(pid)) return;
    await sleep(100);
  }
  try {
    process.kill(pid, 'SIGKILL');
  } catch {
    return;
  }
  const killDeadline = Date.now() + timeoutMs;
  while (Date.now() < killDeadline) {
    if (!isProcessAlive(pid)) return;
    await sleep(100);
  }
}

export function createRouterOpencodeManager(
  options: RouterOpencodeManagerOptions,
): RouterOpencodeManager {
  let opencodeChild: ChildProcess | null = null;

  const updateDiagnostics = (actualVersion?: string): void => {
    options.state.cliVersion = options.cliVersion;
    options.state.sidecar = {
      dir: options.sidecar.dir,
      baseUrl: options.sidecar.baseUrl,
      manifestUrl: options.sidecar.manifestUrl,
      target: options.sidecar.target,
      source: options.sidecarSource,
      opencodeSource: options.opencodeSource,
      allowExternal: options.allowExternal,
    };
    options.state.binaries = {
      opencode: {
        path: options.opencodeBinary.bin,
        source: options.opencodeBinary.source,
        expectedVersion: options.opencodeBinary.expectedVersion,
        actualVersion,
      },
    };
  };

  const ensureOpencode = async (): Promise<{
    baseUrl: string;
    client: OpencodeClient;
  }> => {
    const existing = options.state.opencode;
    if (existing && isProcessAlive(existing.pid)) {
      const client = createOpencodeSdkClient({
        baseUrl: existing.baseUrl,
        directory: options.resolvedWorkdir,
        headers: options.authHeaders,
      });
      try {
        await waitForOpencodeHealthy(client, 2_000, 200);
        if (
          !options.state.sidecar ||
          !options.state.cliVersion ||
          !options.state.binaries?.opencode
        ) {
          updateDiagnostics(options.state.binaries?.opencode?.actualVersion);
          await saveRouterState(options.statePath, options.state);
        }
        return { baseUrl: existing.baseUrl, client };
      } catch {
        await stopProcessByPid(existing.pid);
        options.state.opencode = undefined;
      }
    }

    if (opencodeChild) {
      await stopChild(opencodeChild);
    }

    const opencodeActualVersion = await verifyOpencodeVersion(options.opencodeBinary);
    options.logVerbose(`opencode version: ${opencodeActualVersion ?? 'unknown'}`);
    const child = await startOpencode({
      bin: options.opencodeBinary.bin,
      workspace: options.resolvedWorkdir,
      bindHost: options.opencodeHost,
      port: options.opencodePort,
      username: options.opencodePassword ? options.opencodeUsername : undefined,
      password: options.opencodePassword,
      corsOrigins: options.corsOrigins.length ? options.corsOrigins : ['*'],
      logger: options.logger,
      runId: options.runId,
      logFormat: options.logFormat,
    });
    opencodeChild = child;
    options.logger.info('Process spawned', { pid: child.pid ?? 0 }, 'opencode');
    const baseUrl = `http://${options.opencodeHost}:${options.opencodePort}`;
    const client = createOpencodeSdkClient({
      baseUrl,
      directory: options.resolvedWorkdir,
      headers: options.authHeaders,
    });
    options.logger.info('Waiting for health', { url: baseUrl }, 'opencode');
    await waitForOpencodeHealthy(client);
    options.logger.info('Healthy', { url: baseUrl }, 'opencode');
    options.state.opencode = {
      pid: child.pid ?? 0,
      port: options.opencodePort,
      baseUrl,
      startedAt: nowMs(),
    };
    updateDiagnostics(opencodeActualVersion);
    await saveRouterState(options.statePath, options.state);
    return { baseUrl, client };
  };

  const shutdown = async (): Promise<void> => {
    if (opencodeChild) {
      await stopChild(opencodeChild);
      opencodeChild = null;
    }
  };

  return {
    ensureOpencode,
    shutdown,
    getChild: () => opencodeChild,
  };
}
