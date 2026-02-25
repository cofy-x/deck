/**
 * @license
 * Copyright 2025 cofy-x
 * SPDX-License-Identifier: Apache-2.0
 */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import pino from 'pino';
import { afterEach, describe, expect, test, vi } from 'vitest';

import { BridgeStore } from '../../db.js';
import type { Config, SendTextFn } from '../../types/index.js';
import { handleCommand } from './commands.js';
import { ModelStore } from '../state/model-store.js';

function createConfig(): Config {
  return {
    configPath: '/tmp/bridge.config.json',
    configFile: { version: 1 },
    opencodeUrl: 'http://localhost:4096',
    opencodeDirectory: '/tmp',
    telegramEnabled: true,
    slackEnabled: false,
    feishuWebhookUrl: undefined,
    feishuVerificationToken: undefined,
    feishuEventPort: 3011,
    feishuEventPath: '/events/feishu',
    feishuEnabled: false,
    discordToken: undefined,
    discordMentionInGuilds: true,
    discordEnabled: false,
    dingtalkWebhookUrl: undefined,
    dingtalkVerificationToken: undefined,
    dingtalkEventPort: 3012,
    dingtalkEventPath: '/events/dingtalk',
    dingtalkEnabled: false,
    emailEnabled: false,
    emailImapHost: undefined,
    emailImapPort: 993,
    emailImapSecure: true,
    emailImapUser: undefined,
    emailImapPassword: undefined,
    emailImapMailbox: 'INBOX',
    emailPollIntervalSeconds: 30,
    emailSmtpHost: undefined,
    emailSmtpPort: 587,
    emailSmtpSecure: false,
    emailSmtpUser: undefined,
    emailSmtpPassword: undefined,
    emailFromAddress: undefined,
    emailSubjectPrefix: 'Re: ',
    emailAutoReplyEnabled: true,
    mochatEnabled: false,
    mochatBaseUrl: 'https://mochat.io',
    mochatClawToken: undefined,
    mochatSessions: [],
    mochatPollIntervalMs: 30000,
    mochatWatchTimeoutMs: 25000,
    mochatWatchLimit: 100,
    qqEnabled: false,
    qqApiBaseUrl: 'http://127.0.0.1:5700',
    qqAccessToken: undefined,
    qqWebhookPort: 3013,
    qqWebhookPath: '/events/qq',
    channelAccessPolicy: {
      telegram: 'open',
      whatsapp: 'open',
      slack: 'open',
      feishu: 'open',
      discord: 'open',
      dingtalk: 'open',
      email: 'open',
      mochat: 'open',
      qq: 'open',
    },
    whatsappAuthDir: '/tmp/wa',
    whatsappAccountId: 'default',
    whatsappAllowFrom: new Set<string>(),
    whatsappSelfChatMode: false,
    whatsappEnabled: true,
    dataDir: '/tmp',
    dbPath: '/tmp/db.sqlite',
    logFile: '/tmp/bridge.log',
    allowlist: {
      telegram: new Set<string>(),
      whatsapp: new Set<string>(),
      slack: new Set<string>(),
      feishu: new Set<string>(),
      discord: new Set<string>(),
      dingtalk: new Set<string>(),
      email: new Set<string>(),
      mochat: new Set<string>(),
      qq: new Set<string>(),
    },
    toolUpdatesEnabled: true,
    groupsEnabled: false,
    permissionMode: 'allow',
    toolOutputLimit: 1200,
    logLevel: 'info',
  };
}

interface TestContext {
  deps: {
    config: Config;
    store: BridgeStore;
    modelStore: ModelStore;
    logger: pino.Logger;
    sendText: ReturnType<typeof vi.fn<SendTextFn>>;
  };
  cleanup: () => void;
}

function createTestContext(): TestContext {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bridge-commands-'));
  const store = new BridgeStore(path.join(tempDir, 'bridge.sqlite'));
  const modelStore = new ModelStore();
  const sendText = vi.fn<SendTextFn>(async () => undefined);
  const logger = pino({ enabled: false });

  return {
    deps: {
      config: createConfig(),
      store,
      modelStore,
      logger,
      sendText,
    },
    cleanup: () => {
      store.close();
      fs.rmSync(tempDir, { recursive: true, force: true });
    },
  };
}

const cleanups: Array<() => void> = [];

afterEach(() => {
  while (cleanups.length > 0) {
    const cleanup = cleanups.pop();
    cleanup?.();
  }
});

describe('handleCommand', () => {
  test('uses peerKey for storage but replyPeerId for WhatsApp /reset reply', async () => {
    const context = createTestContext();
    cleanups.push(context.cleanup);
    const { deps } = context;
    const channel = 'whatsapp' as const;
    const peerKey = '+1234567890';
    const replyPeerId = '1234567890@s.whatsapp.net';

    deps.store.upsertSession(channel, peerKey, 'ses_1');
    deps.modelStore.set(channel, peerKey, {
      providerID: 'openai',
      modelID: 'gpt-5',
    });

    const handled = await handleCommand(
      deps,
      channel,
      peerKey,
      replyPeerId,
      '/reset',
    );

    expect(handled).toBe(true);
    expect(deps.store.getSession(channel, peerKey)).toBeNull();
    expect(deps.modelStore.get(channel, peerKey)).toBeUndefined();
    expect(deps.sendText).toHaveBeenCalledWith(
      channel,
      replyPeerId,
      'Session and model reset. Send a message to start fresh.',
      { kind: 'system' },
    );
  });

  test('uses peerKey for model lookup but replies to replyPeerId for /model', async () => {
    const context = createTestContext();
    cleanups.push(context.cleanup);
    const { deps } = context;
    const channel = 'whatsapp' as const;
    const peerKey = '+1234567890';
    const replyPeerId = '1234567890@s.whatsapp.net';
    const model = { providerID: 'openai', modelID: 'gpt-5' };

    deps.modelStore.set(channel, peerKey, model);

    const handled = await handleCommand(
      deps,
      channel,
      peerKey,
      replyPeerId,
      '/model',
    );

    expect(handled).toBe(true);
    expect(deps.sendText).toHaveBeenCalledWith(
      channel,
      replyPeerId,
      `Current model: ${model.providerID}/${model.modelID}`,
      { kind: 'system' },
    );
  });
});
