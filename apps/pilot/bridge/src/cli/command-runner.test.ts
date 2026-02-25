/**
 * @license
 * Copyright 2026 cofy-x
 * SPDX-License-Identifier: Apache-2.0
 */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { Command } from 'commander';
import { afterEach, describe, expect, test, vi } from 'vitest';

import { registerConfigCommands } from './config-cmd.js';
import { registerSendCommand } from './send-cmd.js';
import { registerStatusCommand } from './status-cmd.js';

const originalEnv = { ...process.env };
const tempDirs: string[] = [];

afterEach(() => {
  process.env = { ...originalEnv };
  process.exitCode = undefined;
  for (const dir of tempDirs.splice(0)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
  vi.restoreAllMocks();
});

function createTempConfigFile(content: unknown): { dir: string; configPath: string } {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bridge-cli-command-runner-'));
  tempDirs.push(dir);
  const configPath = path.join(dir, 'bridge.json');
  fs.writeFileSync(configPath, JSON.stringify(content, null, 2) + '\n', 'utf-8');
  return { dir, configPath };
}

function createProgram(register: (program: Command) => void): Command {
  const program = new Command();
  program.option('--json', 'Output JSON');
  register(program);
  return program;
}

async function parseCommand(program: Command, argv: string[]): Promise<void> {
  await program.parseAsync(argv, { from: 'node' });
}

function parseLastJsonLog(logSpy: ReturnType<typeof vi.spyOn>): Record<string, unknown> {
  const call = logSpy.mock.calls.at(-1);
  if (!call || typeof call[0] !== 'string') {
    throw new Error('Expected JSON output in last console.log call');
  }
  const value = JSON.parse(call[0]) as unknown;
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('Expected JSON object output');
  }
  return value as Record<string, unknown>;
}

describe('CLI command runner regressions', () => {
  test('status command prints JSON output with --json and keeps exitCode clear', async () => {
    const { configPath } = createTempConfigFile({ version: 1 });
    process.env = {
      ...process.env,
      BRIDGE_CONFIG_PATH: configPath,
    };

    const program = createProgram(registerStatusCommand);
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    await parseCommand(program, ['node', 'bridge', '--json', 'status']);

    expect(errSpy).not.toHaveBeenCalled();
    expect(process.exitCode).toBeUndefined();

    const payload = parseLastJsonLog(logSpy);
    expect(payload['config']).toBe(configPath);
    expect(payload['whatsapp']).toBeTypeOf('object');
    expect(payload['telegram']).toBeTypeOf('object');
    expect(payload['opencode']).toBeTypeOf('object');
  });

  test('config set command writes JSON success payload with --json', async () => {
    const { configPath } = createTempConfigFile({ version: 1 });
    process.env = {
      ...process.env,
      BRIDGE_CONFIG_PATH: configPath,
    };

    const program = createProgram(registerConfigCommands);
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    await parseCommand(program, [
      'node',
      'bridge',
      '--json',
      'config',
      'set',
      'channels.telegram.token',
      'token-123',
    ]);

    expect(errSpy).not.toHaveBeenCalled();
    expect(process.exitCode).toBeUndefined();

    const payload = parseLastJsonLog(logSpy);
    expect(payload['success']).toBe(true);
    expect(payload['key']).toBe('channels.telegram.token');
    expect(payload['value']).toBe('token-123');

    const written = JSON.parse(fs.readFileSync(configPath, 'utf-8')) as {
      channels?: { telegram?: { token?: string } };
    };
    expect(written.channels?.telegram?.token).toBe('token-123');
  });

  test('send command returns JSON error payload and exitCode=1 for invalid channel', async () => {
    const { configPath } = createTempConfigFile({ version: 1 });
    process.env = {
      ...process.env,
      BRIDGE_CONFIG_PATH: configPath,
    };

    const program = createProgram(registerSendCommand);
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    await parseCommand(program, [
      'node',
      'bridge',
      '--json',
      'send',
      '--channel',
      'invalid',
      '--to',
      'target-1',
      '--message',
      'hello',
    ]);

    expect(process.exitCode).toBe(1);
    expect(errSpy).not.toHaveBeenCalled();

    const payload = parseLastJsonLog(logSpy);
    expect(payload['success']).toBe(false);
    expect(payload['error']).toEqual(
      expect.stringContaining('Invalid channel: invalid'),
    );
  });

  test('send command writes stderr and exitCode=1 without --json on failure', async () => {
    const { configPath } = createTempConfigFile({ version: 1 });
    process.env = {
      ...process.env,
      BRIDGE_CONFIG_PATH: configPath,
    };

    const program = createProgram(registerSendCommand);
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    await parseCommand(program, [
      'node',
      'bridge',
      'send',
      '--channel',
      'invalid',
      '--to',
      'target-1',
      '--message',
      'hello',
    ]);

    expect(process.exitCode).toBe(1);
    expect(logSpy).not.toHaveBeenCalled();
    expect(errSpy).toHaveBeenCalled();
    expect(String(errSpy.mock.calls[0]?.[0])).toContain(
      'Failed to send message: Invalid channel: invalid',
    );
  });

  test('config command returns JSON error payload and exitCode=1 for invalid config schema', async () => {
    const { configPath } = createTempConfigFile({ version: 'bad-schema' });
    process.env = {
      ...process.env,
      BRIDGE_CONFIG_PATH: configPath,
    };

    const program = createProgram(registerConfigCommands);
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    await parseCommand(program, ['node', 'bridge', '--json', 'config', 'get']);

    expect(process.exitCode).toBe(1);
    expect(errSpy).not.toHaveBeenCalled();

    const payload = parseLastJsonLog(logSpy);
    expect(payload['success']).toBe(false);
    expect(payload['error']).toEqual(
      expect.stringContaining('Invalid JSON value for bridge config file'),
    );
  });

  test('status command writes stderr and exitCode=1 without --json on schema error', async () => {
    const { configPath } = createTempConfigFile({ version: 'bad-schema' });
    process.env = {
      ...process.env,
      BRIDGE_CONFIG_PATH: configPath,
    };

    const program = createProgram(registerStatusCommand);
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    await parseCommand(program, ['node', 'bridge', 'status']);

    expect(process.exitCode).toBe(1);
    expect(logSpy).not.toHaveBeenCalled();
    expect(errSpy).toHaveBeenCalled();
    expect(String(errSpy.mock.calls[0]?.[0])).toContain(
      'Invalid JSON value for bridge config file',
    );
  });
});
