/**
 * @license
 * Copyright 2026 cofy-x
 * SPDX-License-Identifier: Apache-2.0
 */

import type { ChildProcess } from 'node:child_process';
import { spawn } from 'node:child_process';

import { mergeResourceAttributes } from '../logger.js';
import type { ApprovalMode, LogFormat, Logger } from '../types/index.js';
import { prefixStream, resolveBinCommand } from '../utils/process.js';

interface StartOpencodeOptions {
  bin: string;
  workspace: string;
  bindHost: string;
  port: number;
  username?: string;
  password?: string;
  corsOrigins: string[];
  logger: Logger;
  runId: string;
  logFormat: LogFormat;
}

export async function startOpencode(
  options: StartOpencodeOptions,
): Promise<ChildProcess> {
  const args = [
    'serve',
    '--hostname',
    options.bindHost,
    '--port',
    String(options.port),
  ];
  for (const origin of options.corsOrigins) {
    args.push('--cors', origin);
  }

  const child = spawn(options.bin, args, {
    cwd: options.workspace,
    stdio: ['ignore', 'pipe', 'pipe'],
    env: {
      ...process.env,
      OPENCODE_CLIENT: 'pilot',
      PILOT: '1',
      PILOT_RUN_ID: options.runId,
      PILOT_LOG_FORMAT: options.logFormat,
      OTEL_RESOURCE_ATTRIBUTES: mergeResourceAttributes(
        {
          'service.name': 'opencode',
          'service.instance.id': options.runId,
        },
        process.env['OTEL_RESOURCE_ATTRIBUTES'],
      ),
      ...(options.username
        ? { OPENCODE_SERVER_USERNAME: options.username }
        : {}),
      ...(options.password
        ? { OPENCODE_SERVER_PASSWORD: options.password }
        : {}),
    },
  });

  prefixStream(
    child.stdout,
    'opencode',
    'stdout',
    options.logger,
    child.pid ?? undefined,
  );
  prefixStream(
    child.stderr,
    'opencode',
    'stderr',
    options.logger,
    child.pid ?? undefined,
  );

  return child;
}

interface StartPilotServerOptions {
  bin: string;
  host: string;
  port: number;
  workspace: string;
  token: string;
  hostToken: string;
  approvalMode: ApprovalMode;
  approvalTimeoutMs: number;
  readOnly: boolean;
  corsOrigins: string[];
  opencodeUrl?: string;
  opencodeDirectory?: string;
  opencodeUsername?: string;
  opencodePassword?: string;
  bridgeHealthPort?: number;
  logger: Logger;
  runId: string;
  logFormat: LogFormat;
}

export async function startPilotServer(
  options: StartPilotServerOptions,
): Promise<ChildProcess> {
  const args = [
    '--host',
    options.host,
    '--port',
    String(options.port),
    '--token',
    options.token,
    '--host-token',
    options.hostToken,
    '--workspace',
    options.workspace,
    '--approval',
    options.approvalMode,
    '--approval-timeout',
    String(options.approvalTimeoutMs),
  ];

  if (options.readOnly) {
    args.push('--read-only');
  }
  if (options.corsOrigins.length) {
    args.push('--cors', options.corsOrigins.join(','));
  }
  if (options.opencodeUrl) {
    args.push('--opencode-url', options.opencodeUrl);
  }
  if (options.opencodeDirectory) {
    args.push('--opencode-directory', options.opencodeDirectory);
  }
  if (options.opencodeUsername) {
    args.push('--opencode-username', options.opencodeUsername);
  }
  if (options.opencodePassword) {
    args.push('--opencode-password', options.opencodePassword);
  }
  if (options.logFormat) {
    args.push('--log-format', options.logFormat);
  }

  const resolved = resolveBinCommand(options.bin);
  const child = spawn(resolved.command, [...resolved.prefixArgs, ...args], {
    cwd: options.workspace,
    stdio: ['ignore', 'pipe', 'pipe'],
    env: {
      ...process.env,
      PILOT_TOKEN: options.token,
      PILOT_HOST_TOKEN: options.hostToken,
      PILOT_RUN_ID: options.runId,
      PILOT_LOG_FORMAT: options.logFormat,
      OTEL_RESOURCE_ATTRIBUTES: mergeResourceAttributes(
        {
          'service.name': 'pilot-server',
          'service.instance.id': options.runId,
        },
        process.env['OTEL_RESOURCE_ATTRIBUTES'],
      ),
      ...(options.bridgeHealthPort
        ? { BRIDGE_HEALTH_PORT: String(options.bridgeHealthPort) }
        : {}),
      ...(options.opencodeUrl
        ? { PILOT_OPENCODE_URL: options.opencodeUrl }
        : {}),
      ...(options.opencodeDirectory
        ? { PILOT_OPENCODE_DIRECTORY: options.opencodeDirectory }
        : {}),
      ...(options.opencodeUsername
        ? { PILOT_OPENCODE_USERNAME: options.opencodeUsername }
        : {}),
      ...(options.opencodePassword
        ? { PILOT_OPENCODE_PASSWORD: options.opencodePassword }
        : {}),
    },
  });

  prefixStream(
    child.stdout,
    'pilot-server',
    'stdout',
    options.logger,
    child.pid ?? undefined,
  );
  prefixStream(
    child.stderr,
    'pilot-server',
    'stderr',
    options.logger,
    child.pid ?? undefined,
  );

  return child;
}

async function bridgeSupportsOpencodeUrl(bin: string): Promise<boolean> {
  const resolved = resolveBinCommand(bin);
  return new Promise((resolve) => {
    const child = spawn(resolved.command, [...resolved.prefixArgs, '--help'], {
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let output = '';
    const timeout = setTimeout(() => {
      try {
        child.kill('SIGKILL');
      } catch {
        // ignore
      }
      resolve(output.includes('--opencode-url'));
    }, 1500);

    const onChunk = (chunk: Buffer) => {
      output += chunk.toString();
    };

    child.stdout?.on('data', onChunk);
    child.stderr?.on('data', onChunk);

    child.on('exit', () => {
      clearTimeout(timeout);
      resolve(output.includes('--opencode-url'));
    });
    child.on('error', () => {
      clearTimeout(timeout);
      resolve(false);
    });
  });
}

interface StartBridgeOptions {
  bin: string;
  workspace: string;
  opencodeUrl?: string;
  opencodeUsername?: string;
  opencodePassword?: string;
  bridgeHealthPort?: number;
  logger: Logger;
  runId: string;
  logFormat: LogFormat;
}

export async function startBridge(
  options: StartBridgeOptions,
): Promise<ChildProcess> {
  const args = ['start', options.workspace];
  if (options.opencodeUrl) {
    const supports = await bridgeSupportsOpencodeUrl(options.bin);
    if (supports) {
      args.push('--opencode-url', options.opencodeUrl);
    }
  }

  const resolved = resolveBinCommand(options.bin);
  const child = spawn(resolved.command, [...resolved.prefixArgs, ...args], {
    cwd: options.workspace,
    stdio: ['ignore', 'pipe', 'pipe'],
    env: {
      ...process.env,
      PILOT_RUN_ID: options.runId,
      PILOT_LOG_FORMAT: options.logFormat,
      OTEL_RESOURCE_ATTRIBUTES: mergeResourceAttributes(
        {
          'service.name': 'bridge',
          'service.instance.id': options.runId,
        },
        process.env['OTEL_RESOURCE_ATTRIBUTES'],
      ),
      ...(options.opencodeUrl ? { OPENCODE_URL: options.opencodeUrl } : {}),
      OPENCODE_DIRECTORY: options.workspace,
      ...(options.bridgeHealthPort
        ? { BRIDGE_HEALTH_PORT: String(options.bridgeHealthPort) }
        : {}),
      ...(options.opencodeUsername
        ? { OPENCODE_SERVER_USERNAME: options.opencodeUsername }
        : {}),
      ...(options.opencodePassword
        ? { OPENCODE_SERVER_PASSWORD: options.opencodePassword }
        : {}),
    },
  });

  prefixStream(
    child.stdout,
    'bridge',
    'stdout',
    options.logger,
    child.pid ?? undefined,
  );
  prefixStream(
    child.stderr,
    'bridge',
    'stderr',
    options.logger,
    child.pid ?? undefined,
  );

  return child;
}
