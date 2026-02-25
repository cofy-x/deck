/**
 * @license
 * Copyright 2025 cofy-x
 * SPDX-License-Identifier: Apache-2.0
 */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { Command } from 'commander';
import { afterEach, describe, expect, test, vi } from 'vitest';

import { registerTelegramCommands } from './telegram-cmd.js';

const originalEnv = { ...process.env };

afterEach(() => {
  process.env = { ...originalEnv };
});

describe('telegram CLI', () => {
  test('set-token keeps existing thinkingMode in config', async () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bridge-telegram-cli-'));
    const configPath = path.join(tempDir, 'bridge.json');
    fs.writeFileSync(
      configPath,
      JSON.stringify(
        {
          version: 1,
          channels: {
            telegram: {
              thinkingMode: 'summary',
            },
          },
        },
        null,
        2,
      ) + '\n',
      'utf-8',
    );

    process.env = {
      ...process.env,
      BRIDGE_CONFIG_PATH: configPath,
    };

    const program = new Command();
    program.option('--json', 'Output JSON');
    registerTelegramCommands(program);

    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    try {
      await program.parseAsync(
        ['node', 'pilot-bridge', 'telegram', 'set-token', 'token-123'],
        {
          from: 'node',
        },
      );
    } finally {
      logSpy.mockRestore();
    }

    const nextConfig = JSON.parse(fs.readFileSync(configPath, 'utf-8')) as {
      channels?: { telegram?: { token?: string; enabled?: boolean; thinkingMode?: string } };
    };
    expect(nextConfig.channels?.telegram?.token).toBe('token-123');
    expect(nextConfig.channels?.telegram?.enabled).toBe(true);
    expect(nextConfig.channels?.telegram?.thinkingMode).toBe('summary');

    fs.rmSync(tempDir, { recursive: true, force: true });
  });
});
