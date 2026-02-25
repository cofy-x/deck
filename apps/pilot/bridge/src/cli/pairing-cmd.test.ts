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

import { BridgeStore } from '../db.js';
import { registerPairingCommands } from './pairing-cmd.js';

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

function createTempDb(): { dbPath: string } {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bridge-pairing-cli-'));
  tempDirs.push(dir);
  return { dbPath: path.join(dir, 'bridge.sqlite') };
}

function createProgram(): Command {
  const program = new Command();
  program.option('--json', 'Output JSON');
  registerPairingCommands(program);
  return program;
}

async function parseCommand(argv: string[]): Promise<void> {
  const program = createProgram();
  await program.parseAsync(argv, { from: 'node' });
}

function parseLastJsonLog(logSpy: ReturnType<typeof vi.spyOn>): Record<string, unknown> {
  const call = logSpy.mock.calls.at(-1);
  if (!call || typeof call[0] !== 'string') {
    throw new Error('Expected JSON output in last console.log call');
  }
  return JSON.parse(call[0]) as Record<string, unknown>;
}

describe('pairing CLI', () => {
  test('approve without --channel resolves unique channel match', async () => {
    const { dbPath } = createTempDb();
    process.env = {
      ...process.env,
      OPENCODE_DIRECTORY: '/tmp',
      BRIDGE_DB_PATH: dbPath,
    };

    const store = new BridgeStore(dbPath);
    store.createPairingRequest('telegram', 'user-1', '111111', 10 * 60_000);
    store.close();

    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    await parseCommand(['node', 'bridge', '--json', 'pairing', 'approve', '111111']);
    const payload = parseLastJsonLog(logSpy);

    expect(payload).toMatchObject({
      success: true,
      channel: 'telegram',
      peerId: 'user-1',
    });
    expect(process.exitCode).toBeUndefined();

    const verifyStore = new BridgeStore(dbPath);
    expect(verifyStore.isAllowed('telegram', 'user-1')).toBe(true);
    verifyStore.close();
  });

  test('approve without --channel fails when code is ambiguous', async () => {
    const { dbPath } = createTempDb();
    process.env = {
      ...process.env,
      OPENCODE_DIRECTORY: '/tmp',
      BRIDGE_DB_PATH: dbPath,
    };

    const store = new BridgeStore(dbPath);
    store.createPairingRequest('telegram', 'tg-user', '222222', 10 * 60_000);
    store.createPairingRequest('slack', 'sl-user', '222222', 10 * 60_000);
    store.close();

    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    await parseCommand(['node', 'bridge', '--json', 'pairing', 'approve', '222222']);
    const payload = parseLastJsonLog(logSpy);

    expect(payload['success']).toBe(false);
    expect(String(payload['error'])).toContain('ambiguous');
    expect(process.exitCode).toBe(1);
  });

  test('approve with --channel succeeds for selected channel', async () => {
    const { dbPath } = createTempDb();
    process.env = {
      ...process.env,
      OPENCODE_DIRECTORY: '/tmp',
      BRIDGE_DB_PATH: dbPath,
    };

    const store = new BridgeStore(dbPath);
    store.createPairingRequest('telegram', 'tg-user', '333333', 10 * 60_000);
    store.createPairingRequest('slack', 'sl-user', '333333', 10 * 60_000);
    store.close();

    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    await parseCommand([
      'node',
      'bridge',
      '--json',
      'pairing',
      'approve',
      '333333',
      '--channel',
      'slack',
    ]);
    const payload = parseLastJsonLog(logSpy);

    expect(payload).toMatchObject({
      success: true,
      channel: 'slack',
      peerId: 'sl-user',
    });
    expect(process.exitCode).toBeUndefined();

    const verifyStore = new BridgeStore(dbPath);
    expect(verifyStore.isAllowed('slack', 'sl-user')).toBe(true);
    expect(verifyStore.isAllowed('telegram', 'tg-user')).toBe(false);
    verifyStore.close();
  });

  test('deny with --channel removes the selected pairing request', async () => {
    const { dbPath } = createTempDb();
    process.env = {
      ...process.env,
      OPENCODE_DIRECTORY: '/tmp',
      BRIDGE_DB_PATH: dbPath,
    };

    const store = new BridgeStore(dbPath);
    store.createPairingRequest('qq', 'qq-user', '444444', 10 * 60_000);
    store.close();

    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    await parseCommand([
      'node',
      'bridge',
      '--json',
      'pairing',
      'deny',
      '444444',
      '--channel',
      'qq',
    ]);
    const payload = parseLastJsonLog(logSpy);

    expect(payload).toMatchObject({
      success: true,
      message: 'Pairing request removed',
    });
    expect(process.exitCode).toBe(0);

    const verifyStore = new BridgeStore(dbPath);
    expect(verifyStore.findPairingRequestsByCode('444444')).toHaveLength(0);
    verifyStore.close();
  });
});
