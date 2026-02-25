/**
 * @license
 * Copyright 2025 cofy-x
 * SPDX-License-Identifier: Apache-2.0
 */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import dotenv from 'dotenv';

import { isChannelName, SUPPORTED_CHANNELS } from './channel-meta.js';
import { ConfigFileSchema, ConfigSchema, EnvSchema } from './config-schema.js';
import { parseJsonTextWithSchema } from './safe-json.js';
import type {
  AccessPolicy,
  ChannelName,
  Config,
  ConfigFile,
  ModelRef,
  TelegramThinkingMode,
} from './types/index.js';

// Re-export types for convenience
export type {
  AccessPolicy,
  ChannelName,
  Config,
  ConfigFile,
  ModelRef,
};

const moduleDir = path.dirname(fileURLToPath(import.meta.url));
const packageDir = path.resolve(moduleDir, '..');
dotenv.config({ path: path.join(packageDir, '.env') });
dotenv.config();

// ---------------------------------------------------------------------------
// Parsing utilities
// ---------------------------------------------------------------------------

type EnvLike = NodeJS.ProcessEnv;

function parseBoolean(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined) return fallback;
  return ['1', 'true', 'yes', 'on'].includes(value.toLowerCase());
}

function parseInteger(value: string | undefined): number | undefined {
  if (!value) return undefined;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function parsePositiveInteger(value: string | undefined): number | undefined {
  const parsed = parseInteger(value);
  if (parsed === undefined || parsed <= 0) return undefined;
  return parsed;
}

function parseList(value: string | undefined): string[] {
  if (!value) return [];
  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function isErrnoException(error: unknown): error is NodeJS.ErrnoException {
  if (!(error instanceof Error)) return false;
  const code = Reflect.get(error, 'code');
  return typeof code === 'string';
}

function createAllowlistRecord(): Record<ChannelName, Set<string>> {
  return {
    telegram: new Set<string>(),
    whatsapp: new Set<string>(),
    slack: new Set<string>(),
    feishu: new Set<string>(),
    discord: new Set<string>(),
    dingtalk: new Set<string>(),
    email: new Set<string>(),
    mochat: new Set<string>(),
    qq: new Set<string>(),
  };
}

function createAccessPolicyRecord(
  defaultPolicy: AccessPolicy,
): Record<ChannelName, AccessPolicy> {
  return {
    telegram: defaultPolicy,
    whatsapp: defaultPolicy,
    slack: defaultPolicy,
    feishu: defaultPolicy,
    discord: defaultPolicy,
    dingtalk: defaultPolicy,
    email: defaultPolicy,
    mochat: defaultPolicy,
    qq: defaultPolicy,
  };
}

function parseModel(value: string | undefined): ModelRef | undefined {
  if (!value?.trim()) return undefined;
  const parts = value.trim().split('/');
  if (parts.length < 2) return undefined;
  const providerID = parts[0];
  const modelID = parts.slice(1).join('/');
  if (!providerID || !modelID) return undefined;
  return { providerID, modelID };
}

function expandHome(value: string): string {
  if (!value.startsWith('~/')) return value;
  return path.join(os.homedir(), value.slice(2));
}

// ---------------------------------------------------------------------------
// WhatsApp ID normalization
// ---------------------------------------------------------------------------

export function normalizeWhatsAppId(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return trimmed;
  if (trimmed.endsWith('@g.us')) return trimmed;
  const base = trimmed.replace(/@s\.whatsapp\.net$/i, '');
  if (base.startsWith('+')) return base;
  if (/^\d+$/.test(base)) return `+${base}`;
  return base;
}

function normalizeWhatsAppAllowFrom(list: string[]): Set<string> {
  const set = new Set<string>();
  for (const entry of list) {
    const trimmed = entry.trim();
    if (!trimmed) continue;
    if (trimmed === '*') {
      set.add('*');
      continue;
    }
    set.add(normalizeWhatsAppId(trimmed));
  }
  return set;
}

function normalizeAccessPolicy(
  value: string | undefined,
  fallback: AccessPolicy,
): AccessPolicy {
  if (
    value === 'allowlist' ||
    value === 'open' ||
    value === 'disabled' ||
    value === 'pairing'
  ) {
    return value;
  }
  return fallback;
}

function getChannelFileAccessPolicy(
  configFile: ConfigFile,
  channel: ChannelName,
): string | undefined {
  const channels = (configFile.channels ??
    {}) as Record<string, { accessPolicy?: string } | undefined>;
  return channels[channel]?.accessPolicy;
}

function normalizeAccessPolicyInput(value: string | undefined): string | undefined {
  const normalized = value?.trim().toLowerCase();
  return normalized ? normalized : undefined;
}

function resolveChannelAccessPolicy(
  channel: ChannelName,
  env: EnvLike,
  configFile: ConfigFile,
): AccessPolicy {
  const envValue = normalizeAccessPolicyInput(
    env[`ACCESS_POLICY_${channel.toUpperCase()}`],
  );
  const fileValue = normalizeAccessPolicyInput(
    getChannelFileAccessPolicy(configFile, channel),
  );
  const fallback: AccessPolicy = channel === 'whatsapp' ? 'pairing' : 'open';

  return normalizeAccessPolicy(envValue ?? fileValue, fallback);
}

function normalizeTelegramThinkingMode(
  value: string | undefined,
): TelegramThinkingMode {
  if (value === 'off' || value === 'summary' || value === 'raw_debug') {
    return value;
  }
  return 'off';
}

// ---------------------------------------------------------------------------
// Config file I/O
// ---------------------------------------------------------------------------

function resolveConfigPath(dataDir: string, env: EnvLike): string {
  const override = env['BRIDGE_CONFIG_PATH']?.trim();
  if (override) return expandHome(override);
  return path.join(dataDir, 'bridge.json');
}

export function readConfigFile(configPath: string): {
  exists: boolean;
  config: ConfigFile;
} {
  try {
    const raw = fs.readFileSync(configPath, 'utf-8');
    const parsed = parseJsonTextWithSchema(
      raw,
      ConfigFileSchema,
      `bridge config file (${configPath})`,
    );
    return { exists: true, config: parsed };
  } catch (error) {
    if (isErrnoException(error) && error.code === 'ENOENT') {
      return { exists: false, config: { version: 1 } };
    }
    throw error;
  }
}

export function writeConfigFile(configPath: string, config: ConfigFile) {
  const normalized = ConfigFileSchema.parse(config);
  fs.mkdirSync(path.dirname(configPath), { recursive: true });
  fs.writeFileSync(
    configPath,
    JSON.stringify(normalized, null, 2) + '\n',
    'utf-8',
  );
}

// ---------------------------------------------------------------------------
// Allowlist parsing
// ---------------------------------------------------------------------------

function parseAllowlist(env: EnvLike): Record<ChannelName, Set<string>> {
  const allowlist = createAllowlistRecord();

  const shared = parseList(env['ALLOW_FROM']);
  for (const entry of shared) {
    if (entry.includes(':')) {
      const idx = entry.indexOf(':');
      const channel = entry.slice(0, idx);
      const peer = entry.slice(idx + 1);
      const normalized = channel.trim().toLowerCase();
      if (normalized && peer.trim()) {
        if (isChannelName(normalized)) {
          allowlist[normalized].add(peer.trim());
        }
      }
    } else {
      for (const channel of SUPPORTED_CHANNELS) {
        allowlist[channel].add(entry);
      }
    }
  }

  for (const channel of SUPPORTED_CHANNELS) {
    const envKey = `ALLOW_FROM_${channel.toUpperCase()}`;
    for (const entry of parseList(env[envKey])) {
      allowlist[channel].add(entry);
    }
  }

  return allowlist;
}

// ---------------------------------------------------------------------------
// Main config loader
// ---------------------------------------------------------------------------

export function loadConfig(
  env: EnvLike = process.env,
  options: { requireOpencode?: boolean } = {},
): Config {
  EnvSchema.parse(env);
  const requireOpencode = options.requireOpencode ?? false;

  const defaultDataDir = path.join(os.homedir(), '.deck', 'pilot', 'bridge');
  const dataDir = expandHome(env['BRIDGE_DATA_DIR'] ?? defaultDataDir);
  const dbPath = expandHome(
    env['BRIDGE_DB_PATH'] ?? path.join(dataDir, 'bridge.db'),
  );
  const logFile = expandHome(
    env['BRIDGE_LOG_FILE'] ?? path.join(dataDir, 'logs', 'bridge.log'),
  );
  const configPath = resolveConfigPath(dataDir, env);
  const { config: configFile } = readConfigFile(configPath);
  const opencodeDirectory =
    env['OPENCODE_DIRECTORY']?.trim() || configFile.opencodeDirectory || '';
  if (!opencodeDirectory && requireOpencode) {
    throw new Error('OPENCODE_DIRECTORY is required');
  }
  const resolvedDirectory = opencodeDirectory || process.cwd();
  const whatsappFile = configFile.channels?.whatsapp ?? {};
  const whatsappAccountId = env['WHATSAPP_ACCOUNT_ID']?.trim() || 'default';
  const accountAuthDir = whatsappFile.accounts?.[whatsappAccountId]?.authDir;
  const defaultWhatsappAuthDir = path.join(
    dataDir,
    'credentials',
    'whatsapp',
    whatsappAccountId,
  );
  const whatsappAuthDir = expandHome(
    env['WHATSAPP_AUTH_DIR']?.trim() ||
      accountAuthDir ||
      defaultWhatsappAuthDir,
  );
  const selfChatMode = parseBoolean(
    env['WHATSAPP_SELF_CHAT'],
    whatsappFile.selfChatMode ?? false,
  );
  const envAllowlist = parseAllowlist(env);
  const fileAllowFrom = normalizeWhatsAppAllowFrom(
    whatsappFile.allowFrom ?? [],
  );
  const envAllowFrom = normalizeWhatsAppAllowFrom(
    envAllowlist.whatsapp.size ? [...envAllowlist.whatsapp] : [],
  );
  const whatsappAllowFrom = new Set<string>([
    ...fileAllowFrom,
    ...envAllowFrom,
  ]);
  const channelAccessPolicy = createAccessPolicyRecord('open');
  for (const channel of SUPPORTED_CHANNELS) {
    channelAccessPolicy[channel] = resolveChannelAccessPolicy(
      channel,
      env,
      configFile,
    );
  }

  const toolOutputLimit = parseInteger(env['TOOL_OUTPUT_LIMIT']) ?? 1200;
  const permissionMode =
    env['PERMISSION_MODE']?.toLowerCase() === 'deny' ? 'deny' : 'allow';

  const telegramToken =
    env['TELEGRAM_BOT_TOKEN']?.trim() ||
    configFile.channels?.telegram?.token ||
    undefined;
  const telegramThinkingMode = normalizeTelegramThinkingMode(
    env['TELEGRAM_THINKING_MODE']?.trim().toLowerCase() ||
      configFile.channels?.telegram?.thinkingMode,
  );
  const slackBotToken =
    env['SLACK_BOT_TOKEN']?.trim() ||
    configFile.channels?.slack?.botToken ||
    undefined;
  const slackAppToken =
    env['SLACK_APP_TOKEN']?.trim() ||
    configFile.channels?.slack?.appToken ||
    undefined;
  const feishuWebhookUrl =
    env['FEISHU_WEBHOOK_URL']?.trim() ||
    configFile.channels?.feishu?.webhookUrl ||
    undefined;
  const feishuVerificationToken =
    env['FEISHU_VERIFICATION_TOKEN']?.trim() ||
    configFile.channels?.feishu?.verificationToken ||
    undefined;
  const feishuEventPort =
    parseInteger(env['FEISHU_EVENT_PORT']) ??
    configFile.channels?.feishu?.eventPort ??
    3011;
  const feishuEventPath =
    env['FEISHU_EVENT_PATH']?.trim() ||
    configFile.channels?.feishu?.eventPath ||
    '/events/feishu';
  const discordToken =
    env['DISCORD_BOT_TOKEN']?.trim() ||
    configFile.channels?.discord?.token ||
    undefined;
  const discordMentionInGuilds = parseBoolean(
    env['DISCORD_MENTION_IN_GUILDS'],
    configFile.channels?.discord?.mentionInGuilds ?? true,
  );
  const discordGatewayProxyUrl = env['DISCORD_GATEWAY_PROXY_URL']?.trim() || undefined;
  const discordGatewayHandshakeTimeoutMs = parsePositiveInteger(
    env['DISCORD_GATEWAY_HANDSHAKE_TIMEOUT_MS'],
  );
  const dingtalkWebhookUrl =
    env['DINGTALK_WEBHOOK_URL']?.trim() ||
    configFile.channels?.dingtalk?.webhookUrl ||
    undefined;
  const dingtalkSignSecret =
    env['DINGTALK_SIGN_SECRET']?.trim() ||
    configFile.channels?.dingtalk?.signSecret ||
    undefined;
  const dingtalkVerificationToken =
    env['DINGTALK_VERIFICATION_TOKEN']?.trim() ||
    configFile.channels?.dingtalk?.verificationToken ||
    undefined;
  const dingtalkEventPort =
    parseInteger(env['DINGTALK_EVENT_PORT']) ??
    configFile.channels?.dingtalk?.eventPort ??
    3012;
  const dingtalkEventPath =
    env['DINGTALK_EVENT_PATH']?.trim() ||
    configFile.channels?.dingtalk?.eventPath ||
    '/events/dingtalk';
  const emailImapHost =
    env['EMAIL_IMAP_HOST']?.trim() ||
    configFile.channels?.email?.imapHost ||
    undefined;
  const emailImapPort =
    parseInteger(env['EMAIL_IMAP_PORT']) ??
    configFile.channels?.email?.imapPort ??
    993;
  const emailImapSecure = parseBoolean(
    env['EMAIL_IMAP_SECURE'],
    configFile.channels?.email?.imapSecure ?? true,
  );
  const emailImapUser =
    env['EMAIL_IMAP_USER']?.trim() ||
    configFile.channels?.email?.imapUser ||
    undefined;
  const emailImapPassword =
    env['EMAIL_IMAP_PASSWORD']?.trim() ||
    configFile.channels?.email?.imapPassword ||
    undefined;
  const emailImapMailbox =
    env['EMAIL_IMAP_MAILBOX']?.trim() ||
    configFile.channels?.email?.imapMailbox ||
    'INBOX';
  const emailPollIntervalSeconds =
    parseInteger(env['EMAIL_POLL_INTERVAL_SECONDS']) ??
    configFile.channels?.email?.pollIntervalSeconds ??
    30;
  const emailSmtpHost =
    env['EMAIL_SMTP_HOST']?.trim() ||
    configFile.channels?.email?.smtpHost ||
    undefined;
  const emailSmtpPort =
    parseInteger(env['EMAIL_SMTP_PORT']) ??
    configFile.channels?.email?.smtpPort ??
    587;
  const emailSmtpSecure = parseBoolean(
    env['EMAIL_SMTP_SECURE'],
    configFile.channels?.email?.smtpSecure ?? false,
  );
  const emailSmtpUser =
    env['EMAIL_SMTP_USER']?.trim() ||
    configFile.channels?.email?.smtpUser ||
    undefined;
  const emailSmtpPassword =
    env['EMAIL_SMTP_PASSWORD']?.trim() ||
    configFile.channels?.email?.smtpPassword ||
    undefined;
  const emailFromAddress =
    env['EMAIL_FROM_ADDRESS']?.trim() ||
    configFile.channels?.email?.fromAddress ||
    undefined;
  const emailSubjectPrefix =
    env['EMAIL_SUBJECT_PREFIX']?.trim() ||
    configFile.channels?.email?.subjectPrefix ||
    'Re: ';
  const emailAutoReplyEnabled = parseBoolean(
    env['EMAIL_AUTO_REPLY_ENABLED'],
    configFile.channels?.email?.autoReplyEnabled ?? true,
  );
  const mochatBaseUrl =
    env['MOCHAT_BASE_URL']?.trim() ||
    configFile.channels?.mochat?.baseUrl ||
    'https://mochat.io';
  const mochatClawToken =
    env['MOCHAT_CLAW_TOKEN']?.trim() ||
    configFile.channels?.mochat?.clawToken ||
    undefined;
  const mochatSessions = (() => {
    const fromEnv = parseList(env['MOCHAT_SESSIONS']);
    if (fromEnv.length > 0) return fromEnv;
    return configFile.channels?.mochat?.sessions ?? [];
  })();
  const mochatPollIntervalMs =
    parseInteger(env['MOCHAT_POLL_INTERVAL_MS']) ??
    configFile.channels?.mochat?.pollIntervalMs ??
    30_000;
  const mochatWatchTimeoutMs =
    parseInteger(env['MOCHAT_WATCH_TIMEOUT_MS']) ??
    configFile.channels?.mochat?.watchTimeoutMs ??
    25_000;
  const mochatWatchLimit =
    parseInteger(env['MOCHAT_WATCH_LIMIT']) ??
    configFile.channels?.mochat?.watchLimit ??
    100;
  const qqApiBaseUrl =
    env['QQ_API_BASE_URL']?.trim() ||
    configFile.channels?.qq?.apiBaseUrl ||
    'http://127.0.0.1:5700';
  const qqAccessToken =
    env['QQ_ACCESS_TOKEN']?.trim() ||
    configFile.channels?.qq?.accessToken ||
    undefined;
  const qqWebhookPort =
    parseInteger(env['QQ_WEBHOOK_PORT']) ??
    configFile.channels?.qq?.webhookPort ??
    3013;
  const qqWebhookPath =
    env['QQ_WEBHOOK_PATH']?.trim() ||
    configFile.channels?.qq?.webhookPath ||
    '/events/qq';
  const healthPort = parseInteger(env['BRIDGE_HEALTH_PORT']) ?? 3005;
  const model = parseModel(env['BRIDGE_MODEL']);

  const resolvedConfig: Config = {
    configPath,
    configFile,
    opencodeUrl:
      env['OPENCODE_URL']?.trim() ||
      configFile.opencodeUrl ||
      'http://127.0.0.1:4096',
    opencodeDirectory: resolvedDirectory,
    opencodeUsername: env['OPENCODE_SERVER_USERNAME']?.trim() || undefined,
    opencodePassword: env['OPENCODE_SERVER_PASSWORD']?.trim() || undefined,
    model,
    telegramToken,
    telegramEnabled: parseBoolean(
      env['TELEGRAM_ENABLED'],
      configFile.channels?.telegram?.enabled ?? Boolean(telegramToken),
    ),
    telegramThinkingMode,
    slackBotToken,
    slackAppToken,
    slackEnabled: parseBoolean(
      env['SLACK_ENABLED'],
      configFile.channels?.slack?.enabled ??
        Boolean(slackBotToken && slackAppToken),
    ),
    feishuWebhookUrl,
    feishuVerificationToken,
    feishuEventPort,
    feishuEventPath,
    feishuEnabled: parseBoolean(
      env['FEISHU_ENABLED'],
      configFile.channels?.feishu?.enabled ?? Boolean(feishuWebhookUrl),
    ),
    discordToken,
    discordMentionInGuilds,
    discordGatewayProxyUrl,
    discordGatewayHandshakeTimeoutMs,
    discordEnabled: parseBoolean(
      env['DISCORD_ENABLED'],
      configFile.channels?.discord?.enabled ?? Boolean(discordToken),
    ),
    dingtalkWebhookUrl,
    dingtalkSignSecret,
    dingtalkVerificationToken,
    dingtalkEventPort,
    dingtalkEventPath,
    dingtalkEnabled: parseBoolean(
      env['DINGTALK_ENABLED'],
      configFile.channels?.dingtalk?.enabled ?? Boolean(dingtalkWebhookUrl),
    ),
    emailEnabled: parseBoolean(
      env['EMAIL_ENABLED'],
      configFile.channels?.email?.enabled ??
        Boolean(
          emailImapHost &&
            emailImapUser &&
            emailImapPassword &&
            emailSmtpHost &&
            emailSmtpUser &&
            emailSmtpPassword,
        ),
    ),
    emailImapHost,
    emailImapPort,
    emailImapSecure,
    emailImapUser,
    emailImapPassword,
    emailImapMailbox,
    emailPollIntervalSeconds,
    emailSmtpHost,
    emailSmtpPort,
    emailSmtpSecure,
    emailSmtpUser,
    emailSmtpPassword,
    emailFromAddress,
    emailSubjectPrefix,
    emailAutoReplyEnabled,
    mochatEnabled: parseBoolean(
      env['MOCHAT_ENABLED'],
      configFile.channels?.mochat?.enabled ?? Boolean(mochatClawToken),
    ),
    mochatBaseUrl,
    mochatClawToken,
    mochatSessions,
    mochatPollIntervalMs,
    mochatWatchTimeoutMs,
    mochatWatchLimit,
    qqEnabled: parseBoolean(
      env['QQ_ENABLED'],
      configFile.channels?.qq?.enabled ?? Boolean(qqApiBaseUrl),
    ),
    qqApiBaseUrl,
    qqAccessToken,
    qqWebhookPort,
    qqWebhookPath,
    channelAccessPolicy,
    whatsappAuthDir,
    whatsappAccountId,
    whatsappAllowFrom,
    whatsappSelfChatMode: selfChatMode,
    whatsappEnabled: parseBoolean(env['WHATSAPP_ENABLED'], true),
    dataDir,
    dbPath,
    logFile,
    allowlist: envAllowlist,
    toolUpdatesEnabled: parseBoolean(env['TOOL_UPDATES_ENABLED'], false),
    groupsEnabled: parseBoolean(
      env['GROUPS_ENABLED'],
      configFile.groupsEnabled ?? false,
    ),
    permissionMode,
    toolOutputLimit,
    healthPort,
    logLevel: env['LOG_LEVEL']?.trim() || 'info',
  };
  return ConfigSchema.parse(resolvedConfig);
}
