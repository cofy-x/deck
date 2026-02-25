/**
 * @license
 * Copyright 2026 cofy-x
 * SPDX-License-Identifier: Apache-2.0
 */

import pino from 'pino';

import type {
  ChannelName,
  Config,
  MessageInfo,
  RunState,
  TelegramRunState,
  TelegramThinkingMode,
} from '../../types/index.js';
import { createRunState } from '../state/run-state.js';

export function createBridgeTestConfig(
  permissionMode: 'allow' | 'deny' = 'allow',
  telegramThinkingMode: TelegramThinkingMode = 'off',
): Config {
  return {
    configPath: '/tmp/bridge.config.json',
    configFile: { version: 1 },
    opencodeUrl: 'http://localhost:4096',
    opencodeDirectory: '/tmp',
    telegramEnabled: true,
    telegramThinkingMode,
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
    whatsappEnabled: false,
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
    permissionMode,
    toolOutputLimit: 1200,
    logLevel: 'info',
  };
}

export function createTelegramRunState(sessionID = 'ses_1'): TelegramRunState {
  return createRunState({
    sessionID,
    channel: 'telegram',
    peerId: '7350281763',
    toolUpdatesEnabled: true,
  });
}

export function createGenericRunState(
  channel: Exclude<ChannelName, 'telegram'>,
  sessionID = `ses_${channel}_1`,
): RunState {
  return createRunState({
    sessionID,
    channel,
    peerId: `${channel}-peer`,
    toolUpdatesEnabled: true,
  });
}

export function createUserMessageInfo(
  sessionID: string,
  messageID: string,
): MessageInfo {
  return {
    id: messageID,
    sessionID,
    role: 'user',
    time: { created: Date.now() },
    agent: 'assistant',
    model: {
      providerID: 'openai',
      modelID: 'gpt-5',
    },
  };
}

export function createAssistantMessageInfo(
  sessionID: string,
  messageID: string,
): MessageInfo {
  return {
    id: messageID,
    sessionID,
    role: 'assistant',
    time: { created: Date.now() },
    parentID: 'msg_parent',
    modelID: 'gpt-5',
    providerID: 'openai',
    mode: 'chat',
    agent: 'assistant',
    path: {
      cwd: '/tmp',
      root: '/tmp',
    },
    cost: 0,
    tokens: {
      input: 0,
      output: 0,
      reasoning: 0,
      cache: {
        read: 0,
        write: 0,
      },
    },
  };
}

export function createSilentLogger() {
  return pino({ enabled: false });
}
