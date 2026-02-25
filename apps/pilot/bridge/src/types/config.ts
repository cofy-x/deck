/**
 * @license
 * Copyright 2025 cofy-x
 * SPDX-License-Identifier: Apache-2.0
 */

// ---------------------------------------------------------------------------
// Channel & policy types
// ---------------------------------------------------------------------------

export type ChannelName =
  | 'telegram'
  | 'whatsapp'
  | 'slack'
  | 'feishu'
  | 'discord'
  | 'dingtalk'
  | 'email'
  | 'mochat'
  | 'qq';

export type AccessPolicy = 'open' | 'allowlist' | 'pairing' | 'disabled';

export type PermissionMode = 'allow' | 'deny';
export type TelegramThinkingMode = 'off' | 'summary' | 'raw_debug';

// ---------------------------------------------------------------------------
// Model reference
// ---------------------------------------------------------------------------

export interface ModelRef {
  providerID: string;
  modelID: string;
}

// ---------------------------------------------------------------------------
// Per-channel configuration (on-disk JSON)
// ---------------------------------------------------------------------------

export interface WhatsAppAccountConfig {
  authDir?: string;
  sendReadReceipts?: boolean;
}

export interface WhatsAppChannelConfig {
  accessPolicy?: AccessPolicy;
  allowFrom?: string[];
  selfChatMode?: boolean;
  accounts?: Record<string, WhatsAppAccountConfig>;
}

export interface TelegramChannelConfig {
  token?: string;
  enabled?: boolean;
  accessPolicy?: AccessPolicy;
  thinkingMode?: TelegramThinkingMode;
}

export interface SlackChannelConfig {
  botToken?: string;
  appToken?: string;
  enabled?: boolean;
  accessPolicy?: AccessPolicy;
}

export interface FeishuChannelConfig {
  webhookUrl?: string;
  verificationToken?: string;
  eventPort?: number;
  eventPath?: string;
  enabled?: boolean;
  accessPolicy?: AccessPolicy;
}

export interface DiscordChannelConfig {
  token?: string;
  mentionInGuilds?: boolean;
  enabled?: boolean;
  accessPolicy?: AccessPolicy;
}

export interface DingTalkChannelConfig {
  webhookUrl?: string;
  signSecret?: string;
  verificationToken?: string;
  eventPort?: number;
  eventPath?: string;
  enabled?: boolean;
  accessPolicy?: AccessPolicy;
}

export interface EmailChannelConfig {
  enabled?: boolean;
  imapHost?: string;
  imapPort?: number;
  imapSecure?: boolean;
  imapUser?: string;
  imapPassword?: string;
  imapMailbox?: string;
  pollIntervalSeconds?: number;
  smtpHost?: string;
  smtpPort?: number;
  smtpSecure?: boolean;
  smtpUser?: string;
  smtpPassword?: string;
  fromAddress?: string;
  subjectPrefix?: string;
  autoReplyEnabled?: boolean;
  accessPolicy?: AccessPolicy;
}

export interface MochatChannelConfig {
  enabled?: boolean;
  baseUrl?: string;
  clawToken?: string;
  sessions?: string[];
  pollIntervalMs?: number;
  watchTimeoutMs?: number;
  watchLimit?: number;
  accessPolicy?: AccessPolicy;
}

export interface QqChannelConfig {
  enabled?: boolean;
  apiBaseUrl?: string;
  accessToken?: string;
  webhookPort?: number;
  webhookPath?: string;
  accessPolicy?: AccessPolicy;
}

export interface ChannelsConfig {
  whatsapp?: WhatsAppChannelConfig;
  telegram?: TelegramChannelConfig;
  slack?: SlackChannelConfig;
  feishu?: FeishuChannelConfig;
  discord?: DiscordChannelConfig;
  dingtalk?: DingTalkChannelConfig;
  email?: EmailChannelConfig;
  mochat?: MochatChannelConfig;
  qq?: QqChannelConfig;
}

// ---------------------------------------------------------------------------
// On-disk config file
// ---------------------------------------------------------------------------

export interface ConfigFile {
  version: number;
  opencodeUrl?: string;
  opencodeDirectory?: string;
  groupsEnabled?: boolean;
  channels?: ChannelsConfig;
}

// ---------------------------------------------------------------------------
// Resolved runtime configuration
// ---------------------------------------------------------------------------

export interface Config {
  configPath: string;
  configFile: ConfigFile;
  opencodeUrl: string;
  opencodeDirectory: string;
  opencodeUsername?: string;
  opencodePassword?: string;
  model?: ModelRef;
  telegramToken?: string;
  telegramEnabled: boolean;
  telegramThinkingMode?: TelegramThinkingMode;
  slackBotToken?: string;
  slackAppToken?: string;
  slackEnabled: boolean;
  feishuWebhookUrl?: string;
  feishuVerificationToken?: string;
  feishuEventPort: number;
  feishuEventPath: string;
  feishuEnabled: boolean;
  discordToken?: string;
  discordMentionInGuilds: boolean;
  discordGatewayProxyUrl?: string;
  discordGatewayHandshakeTimeoutMs?: number;
  discordEnabled: boolean;
  dingtalkWebhookUrl?: string;
  dingtalkSignSecret?: string;
  dingtalkVerificationToken?: string;
  dingtalkEventPort: number;
  dingtalkEventPath: string;
  dingtalkEnabled: boolean;
  emailEnabled: boolean;
  emailImapHost?: string;
  emailImapPort: number;
  emailImapSecure: boolean;
  emailImapUser?: string;
  emailImapPassword?: string;
  emailImapMailbox: string;
  emailPollIntervalSeconds: number;
  emailSmtpHost?: string;
  emailSmtpPort: number;
  emailSmtpSecure: boolean;
  emailSmtpUser?: string;
  emailSmtpPassword?: string;
  emailFromAddress?: string;
  emailSubjectPrefix: string;
  emailAutoReplyEnabled: boolean;
  mochatEnabled: boolean;
  mochatBaseUrl: string;
  mochatClawToken?: string;
  mochatSessions: string[];
  mochatPollIntervalMs: number;
  mochatWatchTimeoutMs: number;
  mochatWatchLimit: number;
  qqEnabled: boolean;
  qqApiBaseUrl: string;
  qqAccessToken?: string;
  qqWebhookPort: number;
  qqWebhookPath: string;
  channelAccessPolicy: Record<ChannelName, AccessPolicy>;
  whatsappAuthDir: string;
  whatsappAccountId: string;
  whatsappAllowFrom: Set<string>;
  whatsappSelfChatMode: boolean;
  whatsappEnabled: boolean;
  dataDir: string;
  dbPath: string;
  logFile: string;
  allowlist: Record<ChannelName, Set<string>>;
  toolUpdatesEnabled: boolean;
  groupsEnabled: boolean;
  permissionMode: PermissionMode;
  toolOutputLimit: number;
  healthPort?: number;
  logLevel: string;
}
