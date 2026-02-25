/**
 * @license
 * Copyright 2025 cofy-x
 * SPDX-License-Identifier: Apache-2.0
 */

import type { Logger } from 'pino';

import { CHANNEL_LABELS as CHANNEL_LABEL_MAP } from '../channel-meta.js';
import {
  isDingTalkConfigured,
  isDiscordConfigured,
  isEmailConfigured,
  isFeishuConfigured,
  isMochatConfigured,
  isQqConfigured,
  isSlackConfigured,
  isTelegramConfigured,
} from '../channel-config.js';
import type {
  Adapter,
  BridgeReporter,
  ChannelName,
  Config,
  MessageHandler,
} from '../types/index.js';
import { createDiscordAdapter } from './socket/discord.js';
import { createSlackAdapter } from './socket/slack.js';
import { createTelegramAdapter } from './socket/telegram.js';
import { createWhatsAppAdapter } from './socket/whatsapp/whatsapp-adapter.js';
import { createEmailAdapter } from './polling/email.js';
import { createMochatAdapter } from './polling/mochat.js';
import { createDingTalkAdapter } from './webhook/dingtalk.js';
import { createFeishuAdapter } from './webhook/feishu.js';
import { createQqAdapter } from './webhook/qq.js';

export interface AdapterRegistration {
  name: ChannelName;
  label: string;
  isEnabled: (config: Config) => boolean;
  isConfigured: (config: Config) => boolean;
  create: (
    config: Config,
    logger: Logger,
    onMessage: MessageHandler,
    reporter?: BridgeReporter,
  ) => Adapter;
  seedAllowlist?: (config: Config) => Iterable<string>;
}

const labelFor = (channel: ChannelName): string => CHANNEL_LABEL_MAP[channel];

export const ADAPTER_REGISTRY: AdapterRegistration[] = [
  {
    name: 'telegram',
    label: labelFor('telegram'),
    isEnabled: (config) => config.telegramEnabled,
    isConfigured: isTelegramConfigured,
    create: (config, logger, onMessage) =>
      createTelegramAdapter(config, logger, onMessage),
    seedAllowlist: (config) => config.allowlist.telegram,
  },
  {
    name: 'whatsapp',
    label: labelFor('whatsapp'),
    isEnabled: (config) => config.whatsappEnabled,
    isConfigured: () => true,
    create: (config, logger, onMessage, reporter) =>
      createWhatsAppAdapter(config, logger, onMessage, {
        printQr: true,
        onStatus: reporter?.onStatus,
      }),
    seedAllowlist: (config) =>
      [...config.whatsappAllowFrom].filter((entry) => entry !== '*'),
  },
  {
    name: 'slack',
    label: labelFor('slack'),
    isEnabled: (config) => config.slackEnabled,
    isConfigured: isSlackConfigured,
    create: (config, logger, onMessage) =>
      createSlackAdapter(config, logger, onMessage),
    seedAllowlist: (config) => config.allowlist.slack,
  },
  {
    name: 'feishu',
    label: labelFor('feishu'),
    isEnabled: (config) => config.feishuEnabled,
    isConfigured: isFeishuConfigured,
    create: (config, logger, onMessage) =>
      createFeishuAdapter(config, logger, onMessage),
    seedAllowlist: (config) => config.allowlist.feishu,
  },
  {
    name: 'discord',
    label: labelFor('discord'),
    isEnabled: (config) => config.discordEnabled,
    isConfigured: isDiscordConfigured,
    create: (config, logger, onMessage) =>
      createDiscordAdapter(config, logger, onMessage),
    seedAllowlist: (config) => config.allowlist.discord,
  },
  {
    name: 'dingtalk',
    label: labelFor('dingtalk'),
    isEnabled: (config) => config.dingtalkEnabled,
    isConfigured: isDingTalkConfigured,
    create: (config, logger, onMessage) =>
      createDingTalkAdapter(config, logger, onMessage),
    seedAllowlist: (config) => config.allowlist.dingtalk,
  },
  {
    name: 'email',
    label: labelFor('email'),
    isEnabled: (config) => config.emailEnabled,
    isConfigured: isEmailConfigured,
    create: (config, logger, onMessage) =>
      createEmailAdapter(config, logger, onMessage),
    seedAllowlist: (config) => config.allowlist.email,
  },
  {
    name: 'mochat',
    label: labelFor('mochat'),
    isEnabled: (config) => config.mochatEnabled,
    isConfigured: isMochatConfigured,
    create: (config, logger, onMessage) =>
      createMochatAdapter(config, logger, onMessage),
    seedAllowlist: (config) => config.allowlist.mochat,
  },
  {
    name: 'qq',
    label: labelFor('qq'),
    isEnabled: (config) => config.qqEnabled,
    isConfigured: isQqConfigured,
    create: (config, logger, onMessage) => createQqAdapter(config, logger, onMessage),
    seedAllowlist: (config) => config.allowlist.qq,
  },
];

export const CHANNEL_LABELS = CHANNEL_LABEL_MAP;
