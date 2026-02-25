/**
 * @license
 * Copyright 2026 cofy-x
 * SPDX-License-Identifier: Apache-2.0
 */

import type { ChannelName, Config } from './types/index.js';

export function isTelegramConfigured(config: Config): boolean {
  return Boolean(config.telegramToken);
}

export function isSlackConfigured(config: Config): boolean {
  return Boolean(config.slackBotToken && config.slackAppToken);
}

export function isFeishuConfigured(config: Config): boolean {
  return Boolean(config.feishuWebhookUrl);
}

export function isDiscordConfigured(config: Config): boolean {
  return Boolean(config.discordToken);
}

export function isDingTalkConfigured(config: Config): boolean {
  return Boolean(config.dingtalkWebhookUrl);
}

export function isEmailConfigured(config: Config): boolean {
  return Boolean(
    config.emailImapHost &&
      config.emailImapUser &&
      config.emailImapPassword &&
      config.emailSmtpHost &&
      config.emailSmtpUser &&
      config.emailSmtpPassword,
  );
}

export function isMochatConfigured(config: Config): boolean {
  return Boolean(config.mochatClawToken);
}

export function isQqConfigured(config: Config): boolean {
  return Boolean(config.qqApiBaseUrl);
}

export function isChannelConfigured(config: Config, channel: ChannelName): boolean {
  switch (channel) {
    case 'telegram':
      return isTelegramConfigured(config);
    case 'whatsapp':
      return true;
    case 'slack':
      return isSlackConfigured(config);
    case 'feishu':
      return isFeishuConfigured(config);
    case 'discord':
      return isDiscordConfigured(config);
    case 'dingtalk':
      return isDingTalkConfigured(config);
    case 'email':
      return isEmailConfigured(config);
    case 'mochat':
      return isMochatConfigured(config);
    case 'qq':
      return isQqConfigured(config);
    default:
      return false;
  }
}
