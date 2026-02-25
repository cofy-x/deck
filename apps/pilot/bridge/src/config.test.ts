/**
 * @license
 * Copyright 2025 cofy-x
 * SPDX-License-Identifier: Apache-2.0
 */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, test } from 'vitest';

import { loadConfig } from './config.js';

const cleanups: Array<() => void> = [];

afterEach(() => {
  while (cleanups.length > 0) {
    const cleanup = cleanups.pop();
    cleanup?.();
  }
});

describe('loadConfig', () => {
  test('parses allowlist for extended channels', () => {
    const env: NodeJS.ProcessEnv = {
      OPENCODE_DIRECTORY: '/tmp',
      ALLOW_FROM: 'shared-user,discord:disc-user',
      ALLOW_FROM_QQ: 'qq-only',
      WHATSAPP_ENABLED: 'false',
      TELEGRAM_ENABLED: 'false',
      SLACK_ENABLED: 'false',
      FEISHU_ENABLED: 'false',
      DISCORD_ENABLED: 'false',
      DINGTALK_ENABLED: 'false',
      EMAIL_ENABLED: 'false',
      MOCHAT_ENABLED: 'false',
      QQ_ENABLED: 'false',
    };

    const config = loadConfig(env, { requireOpencode: false });

    expect(config.allowlist.discord.has('shared-user')).toBe(true);
    expect(config.allowlist.discord.has('disc-user')).toBe(true);
    expect(config.allowlist.qq.has('shared-user')).toBe(true);
    expect(config.allowlist.qq.has('qq-only')).toBe(true);
    expect(config.allowlist.email.has('shared-user')).toBe(true);
  });

  test('merges extended channel config from file and env', () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bridge-config-test-'));
    const configPath = path.join(tempDir, 'bridge.json');
    fs.writeFileSync(
      configPath,
      JSON.stringify(
        {
          version: 1,
          channels: {
            telegram: { token: 'file-telegram', thinkingMode: 'summary' },
            discord: { token: 'file-token', enabled: true },
            mochat: { clawToken: 'file-claw', sessions: ['session_1'] },
            qq: { apiBaseUrl: 'http://file.qq' },
          },
        },
        null,
        2,
      ),
      'utf8',
    );

    cleanups.push(() => fs.rmSync(tempDir, { recursive: true, force: true }));

    const env: NodeJS.ProcessEnv = {
      OPENCODE_DIRECTORY: '/tmp',
      BRIDGE_CONFIG_PATH: configPath,
      DISCORD_BOT_TOKEN: 'env-token',
      TELEGRAM_THINKING_MODE: 'raw_debug',
      MOCHAT_SESSIONS: 'session_a,session_b',
      QQ_API_BASE_URL: 'http://env.qq',
      WHATSAPP_ENABLED: 'false',
      TELEGRAM_ENABLED: 'false',
      SLACK_ENABLED: 'false',
      FEISHU_ENABLED: 'false',
      DINGTALK_ENABLED: 'false',
      EMAIL_ENABLED: 'false',
      MOCHAT_ENABLED: 'true',
      QQ_ENABLED: 'true',
    };

    const config = loadConfig(env, { requireOpencode: false });

    expect(config.discordToken).toBe('env-token');
    expect(config.discordEnabled).toBe(true);
    expect(config.telegramThinkingMode).toBe('raw_debug');
    expect(config.mochatSessions).toEqual(['session_a', 'session_b']);
    expect(config.qqApiBaseUrl).toBe('http://env.qq');
  });

  test('resolves dingtalk sign secret from env and config file', () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bridge-config-test-'));
    const configPath = path.join(tempDir, 'bridge.json');
    fs.writeFileSync(
      configPath,
      JSON.stringify(
        {
          version: 1,
          channels: {
            dingtalk: {
              webhookUrl: 'https://example.com/dingtalk',
              signSecret: 'file-secret',
            },
          },
        },
        null,
        2,
      ),
      'utf8',
    );

    cleanups.push(() => fs.rmSync(tempDir, { recursive: true, force: true }));

    const fromEnv = loadConfig(
      {
        OPENCODE_DIRECTORY: '/tmp',
        BRIDGE_CONFIG_PATH: configPath,
        DINGTALK_SIGN_SECRET: 'env-secret',
      },
      { requireOpencode: false },
    );
    expect(fromEnv.dingtalkSignSecret).toBe('env-secret');

    const fromFile = loadConfig(
      {
        OPENCODE_DIRECTORY: '/tmp',
        BRIDGE_CONFIG_PATH: configPath,
      },
      { requireOpencode: false },
    );
    expect(fromFile.dingtalkSignSecret).toBe('file-secret');
  });

  test('prioritizes ACCESS_POLICY_<CHANNEL> over config file accessPolicy', () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bridge-config-test-'));
    const configPath = path.join(tempDir, 'bridge.json');
    fs.writeFileSync(
      configPath,
      JSON.stringify(
        {
          version: 1,
          channels: {
            telegram: {
              accessPolicy: 'allowlist',
            },
            whatsapp: {
              accessPolicy: 'open',
            },
          },
        },
        null,
        2,
      ),
      'utf8',
    );
    cleanups.push(() => fs.rmSync(tempDir, { recursive: true, force: true }));

    const config = loadConfig(
      {
        OPENCODE_DIRECTORY: '/tmp',
        BRIDGE_CONFIG_PATH: configPath,
        ACCESS_POLICY_TELEGRAM: 'pairing',
        ACCESS_POLICY_WHATSAPP: 'disabled',
      },
      { requireOpencode: false },
    );

    expect(config.channelAccessPolicy.telegram).toBe('pairing');
    expect(config.channelAccessPolicy.whatsapp).toBe('disabled');
  });

  test('treats empty ACCESS_POLICY_<CHANNEL> as unset and keeps config file policy', () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bridge-config-test-'));
    const configPath = path.join(tempDir, 'bridge.json');
    fs.writeFileSync(
      configPath,
      JSON.stringify(
        {
          version: 1,
          channels: {
            slack: {
              accessPolicy: 'allowlist',
            },
            telegram: {
              accessPolicy: 'pairing',
            },
          },
        },
        null,
        2,
      ),
      'utf8',
    );
    cleanups.push(() => fs.rmSync(tempDir, { recursive: true, force: true }));

    const config = loadConfig(
      {
        OPENCODE_DIRECTORY: '/tmp',
        BRIDGE_CONFIG_PATH: configPath,
        ACCESS_POLICY_SLACK: '   ',
        ACCESS_POLICY_TELEGRAM: '',
      },
      { requireOpencode: false },
    );

    expect(config.channelAccessPolicy.slack).toBe('allowlist');
    expect(config.channelAccessPolicy.telegram).toBe('pairing');
  });

  test('parses discord gateway proxy and handshake timeout from env', () => {
    const config = loadConfig(
      {
        OPENCODE_DIRECTORY: '/tmp',
        DISCORD_GATEWAY_PROXY_URL: 'socks5h://127.0.0.1:7890',
        DISCORD_GATEWAY_HANDSHAKE_TIMEOUT_MS: '180000',
      },
      { requireOpencode: false },
    );

    expect(config.discordGatewayProxyUrl).toBe('socks5h://127.0.0.1:7890');
    expect(config.discordGatewayHandshakeTimeoutMs).toBe(180000);
  });
});
