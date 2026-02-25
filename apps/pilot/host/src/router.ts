/**
 * @license
 * Copyright 2026 cofy-x
 * SPDX-License-Identifier: Apache-2.0
 */

import { createServer as createHttpServer } from 'node:http';
import type { Server as HttpServer } from 'node:http';

import {
  parseList,
  readBool,
  readFlag,
  readPort,
} from './args.js';
import {
  readVersionManifest,
  resolveOpencodeBin,
  resolveRouterDataDir,
  resolveSidecarConfig,
} from './binary.js';
import { resolveRuntimeConfig } from './runtime-config.js';
import { createRouterHttpHandler } from './router/http-handler.js';
import { createRouterOpencodeManager } from './router/opencode-manager.js';
import {
  loadRouterState,
  routerStatePath,
  saveRouterState,
} from './router/state-store.js';
import type { HttpHeaders, ParsedArgs } from './types/index.js';
import { ensureWorkspace } from './utils/fs.js';
import { fetchJson, outputResult } from './utils/http.js';
import { encodeBasicAuth, resolvePort } from './utils/network.js';
import { pollUntil } from './utils/poll.js';
import {
  DEFAULT_OPENCODE_USERNAME,
  findWorkspace as findWorkspaceInState,
  isProcessAlive,
  nowMs,
  resolveSelfCommand,
} from './utils/process.js';

export { findWorkspaceInState as findWorkspace };
export { loadRouterState, routerStatePath, saveRouterState };

export async function waitForRouterHealthy(
  baseUrl: string,
  timeoutMs = 10_000,
  pollMs = 250,
): Promise<void> {
  const url = baseUrl.replace(/\/$/, '');
  await pollUntil({
    timeoutMs,
    intervalMs: pollMs,
    timeoutMessage: 'Timed out waiting for daemon health',
    attempt: async () => {
      const response = await fetch(`${url}/health`);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      return true;
    },
  });
}

async function spawnRouterDaemon(
  args: ParsedArgs,
  dataDir: string,
  host: string,
  port: number,
): Promise<void> {
  const { spawn } = await import('node:child_process');
  const self = resolveSelfCommand();
  const commandArgs = [
    ...self.prefixArgs,
    'daemon',
    'run',
    '--data-dir',
    dataDir,
    '--daemon-host',
    host,
    '--daemon-port',
    String(port),
  ];

  const opencodeBin =
    readFlag(args.flags, 'opencode-bin') ?? process.env['PILOT_OPENCODE_BIN'];
  const opencodeHost =
    readFlag(args.flags, 'opencode-host') ?? process.env['PILOT_OPENCODE_HOST'];
  const opencodePort =
    readFlag(args.flags, 'opencode-port') ?? process.env['PILOT_OPENCODE_PORT'];
  const opencodeWorkdir =
    readFlag(args.flags, 'opencode-workdir') ??
    process.env['PILOT_OPENCODE_WORKDIR'];
  const opencodeUsername =
    readFlag(args.flags, 'opencode-username') ??
    process.env['PILOT_OPENCODE_USERNAME'];
  const opencodePassword =
    readFlag(args.flags, 'opencode-password') ??
    process.env['PILOT_OPENCODE_PASSWORD'];
  const corsValue =
    readFlag(args.flags, 'cors') ?? process.env['PILOT_OPENCODE_CORS'];
  const allowExternal = readBool(
    args.flags,
    'allow-external',
    false,
    'PILOT_ALLOW_EXTERNAL',
  );
  const sidecarSource =
    readFlag(args.flags, 'sidecar-source') ?? process.env['PILOT_SIDECAR_SOURCE'];
  const opencodeSource =
    readFlag(args.flags, 'opencode-source') ??
    process.env['PILOT_OPENCODE_SOURCE'];
  const verbose = readBool(args.flags, 'verbose', false, 'PILOT_VERBOSE');
  const logFormat =
    readFlag(args.flags, 'log-format') ?? process.env['PILOT_LOG_FORMAT'];
  const runId = readFlag(args.flags, 'run-id') ?? process.env['PILOT_RUN_ID'];

  if (opencodeBin) commandArgs.push('--opencode-bin', opencodeBin);
  if (opencodeHost) commandArgs.push('--opencode-host', opencodeHost);
  if (opencodePort) commandArgs.push('--opencode-port', String(opencodePort));
  if (opencodeWorkdir) commandArgs.push('--opencode-workdir', opencodeWorkdir);
  if (opencodeUsername) commandArgs.push('--opencode-username', opencodeUsername);
  if (opencodePassword) commandArgs.push('--opencode-password', opencodePassword);
  if (corsValue) commandArgs.push('--cors', corsValue);
  if (allowExternal) commandArgs.push('--allow-external');
  if (sidecarSource) commandArgs.push('--sidecar-source', sidecarSource);
  if (opencodeSource) commandArgs.push('--opencode-source', opencodeSource);
  if (verbose) commandArgs.push('--verbose');
  if (logFormat) commandArgs.push('--log-format', String(logFormat));
  if (runId) commandArgs.push('--run-id', String(runId));

  const child = spawn(self.command, commandArgs, {
    detached: true,
    stdio: 'ignore',
    env: { ...process.env },
  });
  child.unref();
}

export async function ensureRouterDaemon(
  args: ParsedArgs,
  autoStart = true,
): Promise<{ baseUrl: string; dataDir: string }> {
  const dataDir = resolveRouterDataDir(args.flags);
  const statePath = routerStatePath(dataDir);
  const state = await loadRouterState(statePath);
  const existing = state.daemon;
  if (existing && existing.baseUrl && isProcessAlive(existing.pid)) {
    try {
      await waitForRouterHealthy(existing.baseUrl, 1_500, 150);
      return { baseUrl: existing.baseUrl, dataDir };
    } catch {
      // fall through and restart
    }
  }

  if (!autoStart) {
    throw new Error('pilot-host daemon is not running');
  }

  const host = readFlag(args.flags, 'daemon-host') ?? '127.0.0.1';
  const port = await resolvePort(
    readPort(args.flags, 'daemon-port', undefined, 'PILOT_DAEMON_PORT'),
    host,
  );
  const baseUrl = `http://${host}:${port}`;
  await spawnRouterDaemon(args, dataDir, host, port);
  await waitForRouterHealthy(baseUrl, 10_000, 250);
  return { baseUrl, dataDir };
}

export async function requestRouter(
  args: ParsedArgs,
  method: string,
  path: string,
  body?: object,
  autoStart = true,
): Promise<object> {
  const { baseUrl } = await ensureRouterDaemon(args, autoStart);
  const url = `${baseUrl.replace(/\/$/, '')}${path}`;
  const headers: HttpHeaders | undefined =
    body !== undefined ? { 'Content-Type': 'application/json' } : undefined;
  const payload = body !== undefined ? JSON.stringify(body) : undefined;
  return fetchJson<object>(url, {
    method,
    headers,
    body: payload,
  });
}

export async function runRouterDaemon(args: ParsedArgs): Promise<number> {
  const runtime = await resolveRuntimeConfig(args, {
    serviceName: 'pilot',
    verboseComponent: 'pilot',
    defaultLogFormat: 'pretty',
  });
  const {
    outputJson,
    logFormat,
    runId,
    cliVersion,
    logger,
    logVerbose,
    sidecarSource,
    opencodeSource,
    allowExternal,
  } = runtime;
  const dataDir = resolveRouterDataDir(args.flags);
  const statePath = routerStatePath(dataDir);
  const state = await loadRouterState(statePath, {
    onWarning: (message) => logger.warn(message, undefined, 'pilot-router'),
  });

  const host = readFlag(args.flags, 'daemon-host') ?? '127.0.0.1';
  const port = await resolvePort(
    readPort(args.flags, 'daemon-port', undefined, 'PILOT_DAEMON_PORT'),
    host,
  );

  const opencodeBin =
    readFlag(args.flags, 'opencode-bin') ?? process.env['PILOT_OPENCODE_BIN'];
  const opencodeHost =
    readFlag(args.flags, 'opencode-host') ??
    process.env['PILOT_OPENCODE_HOST'] ??
    '127.0.0.1';
  const opencodePassword =
    readFlag(args.flags, 'opencode-password') ??
    process.env['PILOT_OPENCODE_PASSWORD'] ??
    process.env['OPENCODE_SERVER_PASSWORD'];
  const opencodeUsername =
    readFlag(args.flags, 'opencode-username') ??
    process.env['PILOT_OPENCODE_USERNAME'] ??
    process.env['OPENCODE_SERVER_USERNAME'] ??
    DEFAULT_OPENCODE_USERNAME;
  const authHeaders = opencodePassword
    ? {
        Authorization: `Basic ${encodeBasicAuth(opencodeUsername, opencodePassword)}`,
      }
    : undefined;
  const opencodePort = await resolvePort(
    readPort(
      args.flags,
      'opencode-port',
      state.opencode?.port,
      'PILOT_OPENCODE_PORT',
    ),
    opencodeHost,
    state.opencode?.port,
  );
  const corsValue =
    readFlag(args.flags, 'cors') ??
    process.env['PILOT_OPENCODE_CORS'] ??
    'http://localhost:5173,tauri://localhost,http://tauri.localhost';
  const corsOrigins = parseList(corsValue);
  const opencodeWorkdirFlag =
    readFlag(args.flags, 'opencode-workdir') ??
    process.env['PILOT_OPENCODE_WORKDIR'];
  const activeWorkspace = state.workspaces.find(
    (entry) => entry.id === state.activeId && entry.workspaceType === 'local',
  );
  const opencodeWorkdir =
    opencodeWorkdirFlag ?? activeWorkspace?.path ?? process.cwd();
  const resolvedWorkdir = await ensureWorkspace(opencodeWorkdir);
  logger.info(
    'Daemon starting',
    { runId, logFormat, workdir: resolvedWorkdir, host, port },
    'pilot',
  );

  const sidecar = resolveSidecarConfig(args.flags, cliVersion);
  const manifest = await readVersionManifest();
  logVerbose(`cli version: ${cliVersion}`);
  logVerbose(`sidecar target: ${sidecar.target ?? 'unknown'}`);
  logVerbose(`sidecar dir: ${sidecar.dir}`);
  logVerbose(`sidecar source: ${sidecarSource}`);
  logVerbose(`opencode source: ${opencodeSource}`);
  logVerbose(`allow external: ${allowExternal ? 'true' : 'false'}`);
  const opencodeBinary = await resolveOpencodeBin({
    explicit: opencodeBin,
    manifest,
    allowExternal,
    sidecar,
    source: opencodeSource,
  });
  logVerbose(`opencode bin: ${opencodeBinary.bin} (${opencodeBinary.source})`);

  const opencodeManager = createRouterOpencodeManager({
    state,
    statePath,
    opencodeBinary,
    resolvedWorkdir,
    opencodeHost,
    opencodePort,
    opencodeUsername,
    opencodePassword,
    authHeaders,
    corsOrigins,
    logger,
    logVerbose,
    runId,
    logFormat,
    cliVersion,
    sidecar,
    sidecarSource,
    opencodeSource,
    allowExternal,
  });

  await opencodeManager.ensureOpencode();

  let server: HttpServer | null = null;
  let shuttingDown = false;
  let completed = false;
  let completeRun: (code: number) => void = () => undefined;
  const done = new Promise<number>((resolve) => {
    completeRun = (code: number) => {
      if (completed) return;
      completed = true;
      resolve(code);
    };
  });

  const shutdown = async (code = 0): Promise<void> => {
    if (shuttingDown) return;
    shuttingDown = true;
    logger.info('Daemon shutting down', { host, port }, 'pilot-router');
    if (server) {
      try {
        await new Promise<void>((resolve) => server?.close(() => resolve()));
      } catch {
        // ignore close errors
      }
    }
    await opencodeManager.shutdown();
    state.daemon = undefined;
    if (state.opencode && !isProcessAlive(state.opencode.pid)) {
      state.opencode = undefined;
    }
    try {
      await saveRouterState(statePath, state);
    } catch (error) {
      logger.warn(
        'Failed to persist daemon state during shutdown',
        { error: String(error) },
        'pilot-router',
      );
      completeRun(1);
      return;
    }
    completeRun(code);
  };

  const handler = createRouterHttpHandler({
    host,
    port,
    logger,
    state,
    statePath,
    authHeaders,
    ensureOpencode: opencodeManager.ensureOpencode,
    shutdown,
  });

  server = createHttpServer((req, res) => {
    void handler(req, res);
  });

  await new Promise<void>((resolve, reject) => {
    const onError = (error: Error) => {
      reject(error);
    };
    server?.once('error', onError);
    server?.listen(port, host, () => {
      server?.off('error', onError);
      resolve();
    });
  });

  state.daemon = {
    pid: process.pid,
    port,
    baseUrl: `http://${host}:${port}`,
    startedAt: nowMs(),
  };
  await saveRouterState(statePath, state);
  if (outputJson) {
    outputResult({ ok: true, daemon: state.daemon }, true);
  } else if (logFormat === 'json') {
    logger.info('Daemon running', { host, port }, 'pilot-router');
  } else {
    process.stdout.write(`pilot-host daemon running on ${host}:${port}\n`);
  }
  server.on('error', (error) => {
    logger.error(
      'Router server error',
      { error: String(error) },
      'pilot-router',
    );
    void shutdown(1);
  });

  const onSigint = () => void shutdown(0);
  const onSigterm = () => void shutdown(0);
  process.on('SIGINT', onSigint);
  process.on('SIGTERM', onSigterm);
  const exitCode = await done;
  process.off('SIGINT', onSigint);
  process.off('SIGTERM', onSigterm);
  return exitCode;
}
