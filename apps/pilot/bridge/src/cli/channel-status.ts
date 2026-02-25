/**
 * @license
 * Copyright 2025 cofy-x
 * SPDX-License-Identifier: Apache-2.0
 */

import type { Config, TelegramThinkingMode } from '../types/index.js';
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

export function buildHealthChannelState(
  config: Config,
  whatsappLinked: boolean,
): {
  whatsapp: 'linked' | 'unlinked';
  telegram: 'configured' | 'unconfigured';
  slack: 'configured' | 'unconfigured';
  feishu: 'configured' | 'unconfigured';
  discord: 'configured' | 'unconfigured';
  dingtalk: 'configured' | 'unconfigured';
  email: 'configured' | 'unconfigured';
  mochat: 'configured' | 'unconfigured';
  qq: 'configured' | 'unconfigured';
} {
  return {
    whatsapp: whatsappLinked ? 'linked' : 'unlinked',
    telegram: isTelegramConfigured(config) ? 'configured' : 'unconfigured',
    slack: isSlackConfigured(config) ? 'configured' : 'unconfigured',
    feishu: isFeishuConfigured(config) ? 'configured' : 'unconfigured',
    discord: isDiscordConfigured(config) ? 'configured' : 'unconfigured',
    dingtalk: isDingTalkConfigured(config) ? 'configured' : 'unconfigured',
    email: isEmailConfigured(config) ? 'configured' : 'unconfigured',
    mochat: isMochatConfigured(config) ? 'configured' : 'unconfigured',
    qq: isQqConfigured(config) ? 'configured' : 'unconfigured',
  };
}

export function buildStatusChannelState(
  config: Config,
  whatsappLinked: boolean,
): {
  whatsapp: {
    linked: boolean;
    accessPolicy: Config['channelAccessPolicy']['whatsapp'];
    selfChatMode: boolean;
    authDir: string;
  };
  telegram: {
    configured: boolean;
    enabled: boolean;
    thinkingMode: TelegramThinkingMode;
  };
  slack: { configured: boolean; enabled: boolean };
  feishu: { configured: boolean; enabled: boolean };
  discord: { configured: boolean; enabled: boolean };
  dingtalk: { configured: boolean; enabled: boolean };
  email: { configured: boolean; enabled: boolean };
  mochat: { configured: boolean; enabled: boolean };
  qq: { configured: boolean; enabled: boolean };
} {
  return {
    whatsapp: {
      linked: whatsappLinked,
      accessPolicy: config.channelAccessPolicy.whatsapp,
      selfChatMode: config.whatsappSelfChatMode,
      authDir: config.whatsappAuthDir,
    },
    telegram: {
      configured: isTelegramConfigured(config),
      enabled: config.telegramEnabled,
      thinkingMode: config.telegramThinkingMode ?? 'off',
    },
    slack: {
      configured: isSlackConfigured(config),
      enabled: config.slackEnabled,
    },
    feishu: {
      configured: isFeishuConfigured(config),
      enabled: config.feishuEnabled,
    },
    discord: {
      configured: isDiscordConfigured(config),
      enabled: config.discordEnabled,
    },
    dingtalk: {
      configured: isDingTalkConfigured(config),
      enabled: config.dingtalkEnabled,
    },
    email: {
      configured: isEmailConfigured(config),
      enabled: config.emailEnabled,
    },
    mochat: {
      configured: isMochatConfigured(config),
      enabled: config.mochatEnabled,
    },
    qq: {
      configured: isQqConfigured(config),
      enabled: config.qqEnabled,
    },
  };
}
