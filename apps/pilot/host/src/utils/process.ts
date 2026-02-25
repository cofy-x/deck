/**
 * @license
 * Copyright 2026 cofy-x
 * SPDX-License-Identifier: Apache-2.0
 */

import type { ChildProcess } from 'node:child_process';
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { once } from 'node:events';
import type { Readable } from 'node:stream';
import { resolve } from 'node:path';

import type { LogLevel, Logger } from '../types/index.js';
import { looksLikeOtelLogLine } from '../logger.js';
import type { RouterState, RouterWorkspace } from '../types/index.js';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const DEFAULT_PILOT_PORT = 8787;
export const DEFAULT_BRIDGE_HEALTH_PORT = 3005;
export const DEFAULT_APPROVAL_TIMEOUT = 30000;
export const DEFAULT_OPENCODE_USERNAME = 'opencode';

// ---------------------------------------------------------------------------
// Workspace ID generation
// ---------------------------------------------------------------------------

export function normalizeWorkspacePath(input: string): string {
  return resolve(input).replace(/[\\/]+$/, '');
}

export function workspaceIdForLocal(path: string): string {
  return `ws-${createHash('sha1').update(path).digest('hex').slice(0, 12)}`;
}

export function workspaceIdForRemote(
  baseUrl: string,
  directory?: string | null,
): string {
  const key = directory ? `${baseUrl}::${directory}` : baseUrl;
  return `ws-${createHash('sha1').update(key).digest('hex').slice(0, 12)}`;
}

// ---------------------------------------------------------------------------
// Workspace lookup
// ---------------------------------------------------------------------------

export function findWorkspace(
  state: RouterState,
  input: string,
): RouterWorkspace | undefined {
  const trimmed = input.trim();
  if (!trimmed) return undefined;
  const direct = state.workspaces.find(
    (entry) => entry.id === trimmed || entry.name === trimmed,
  );
  if (direct) return direct;
  const normalized = normalizeWorkspacePath(trimmed);
  return state.workspaces.find(
    (entry) => entry.path && normalizeWorkspacePath(entry.path) === normalized,
  );
}

// ---------------------------------------------------------------------------
// Process helpers
// ---------------------------------------------------------------------------

export function isProcessAlive(pid?: number): boolean {
  if (!pid || pid <= 0) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

export function nowMs(): number {
  return Date.now();
}

// ---------------------------------------------------------------------------
// Binary command resolution
// ---------------------------------------------------------------------------

export interface ResolvedCommand {
  command: string;
  prefixArgs: string[];
}

export function resolveBinCommand(bin: string): ResolvedCommand {
  if (bin.endsWith('.ts')) {
    return { command: 'node', prefixArgs: ['--loader', 'tsx', bin, '--'] };
  }
  if (bin.endsWith('.js')) {
    return { command: 'node', prefixArgs: [bin, '--'] };
  }
  return { command: bin, prefixArgs: [] };
}

export function resolveSelfCommand(): ResolvedCommand {
  const arg1 = process.argv[1];
  if (!arg1) return { command: process.argv[0], prefixArgs: [] };
  if (arg1.endsWith('.js') || arg1.endsWith('.ts')) {
    return { command: process.argv[0], prefixArgs: [arg1] };
  }
  return { command: process.argv[0], prefixArgs: [] };
}

export function resolveBinPath(bin: string): string {
  if (bin.includes('/') || bin.startsWith('.')) {
    return resolve(process.cwd(), bin);
  }
  return bin;
}

// ---------------------------------------------------------------------------
// Stream prefix (pipes child stdout/stderr through logger)
// ---------------------------------------------------------------------------

export function prefixStream(
  stream: Readable | null,
  label: string,
  level: 'stdout' | 'stderr',
  logger: Logger,
  pid?: number,
): void {
  if (!stream) return;
  stream.setEncoding('utf8');
  let buffer = '';
  stream.on('data', (chunk: string) => {
    buffer += chunk;
    const lines = buffer.split(/\r?\n/);
    buffer = lines.pop() ?? '';
    for (const line of lines) {
      if (!line.trim()) continue;
      if (
        logger.output === 'stdout' &&
        logger.format === 'json' &&
        looksLikeOtelLogLine(line)
      ) {
        process.stdout.write(`${line}\n`);
        continue;
      }
      const severity: LogLevel = level === 'stderr' ? 'error' : 'info';
      logger.log(severity, line, { stream: level, pid }, label);
    }
  });
  stream.on('end', () => {
    if (!buffer.trim()) return;
    if (
      logger.output === 'stdout' &&
      logger.format === 'json' &&
      looksLikeOtelLogLine(buffer)
    ) {
      process.stdout.write(`${buffer}\n`);
      return;
    }
    const severity: LogLevel = level === 'stderr' ? 'error' : 'info';
    logger.log(severity, buffer, { stream: level, pid }, label);
  });
}

// ---------------------------------------------------------------------------
// Child process lifecycle
// ---------------------------------------------------------------------------

export async function stopChild(
  child: ChildProcess,
  timeoutMs = 2500,
): Promise<void> {
  if (child.exitCode !== null || child.signalCode !== null) return;
  try {
    child.kill('SIGTERM');
  } catch {
    return;
  }
  const exited = await Promise.race([
    once(child, 'exit').then(() => true),
    new Promise((resolve) => setTimeout(resolve, timeoutMs, false)),
  ]);
  if (exited) return;
  try {
    child.kill('SIGKILL');
  } catch {
    return;
  }
  await Promise.race([
    once(child, 'exit').then(() => true),
    new Promise((resolve) => setTimeout(resolve, timeoutMs, false)),
  ]);
}

export async function captureCommandOutput(
  bin: string,
  args: string[],
  options?: { env?: NodeJS.ProcessEnv; timeoutMs?: number },
): Promise<string> {
  const resolved = resolveBinCommand(bin);
  const child = spawn(resolved.command, [...resolved.prefixArgs, ...args], {
    stdio: ['ignore', 'pipe', 'pipe'],
    env: options?.env ?? process.env,
  });
  let output = '';
  child.stdout?.on('data', (chunk: Buffer) => {
    output += chunk.toString();
  });
  child.stderr?.on('data', (chunk: Buffer) => {
    output += chunk.toString();
  });

  const timeoutMs = options?.timeoutMs ?? 30_000;
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
    throw new Error('Command timed out');
  }

  if (result === 'error') {
    throw new Error('Command failed to run');
  }

  return output.trim();
}

export async function runCommand(
  command: string,
  args: string[],
  cwd?: string,
): Promise<void> {
  const child = spawn(command, args, { cwd, stdio: 'inherit' });
  const result = await Promise.race([
    once(child, 'exit').then(([code]) => ({
      type: 'exit' as const,
      code: code as number | null,
    })),
    once(child, 'error').then(([error]) => ({ type: 'error' as const, error })),
  ]);
  if (result.type === 'error') {
    throw new Error(
      `Command failed: ${command} ${args.join(' ')}: ${String(result.error)}`,
    );
  }
  if (result.code !== 0) {
    throw new Error(`Command failed: ${command} ${args.join(' ')}`);
  }
}

// ---------------------------------------------------------------------------
// Event normalization
// ---------------------------------------------------------------------------

interface EventWithType {
  type: string;
}

interface EventWithPayload {
  payload?: EventWithType;
}

export function normalizeEvent(raw: object | null): EventWithType | null {
  if (!raw) return null;
  if ('type' in raw) {
    const candidate = raw as EventWithType;
    if (typeof candidate.type === 'string') return { type: candidate.type };
  }
  if ('payload' in raw) {
    const candidate = raw as EventWithPayload;
    if (candidate.payload && typeof candidate.payload.type === 'string') {
      return { type: candidate.payload.type };
    }
  }
  return null;
}
