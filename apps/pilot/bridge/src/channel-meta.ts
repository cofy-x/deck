/**
 * @license
 * Copyright 2025 cofy-x
 * SPDX-License-Identifier: Apache-2.0
 */

import type { ChannelName } from './types/index.js';

export const SUPPORTED_CHANNELS: readonly ChannelName[] = [
  'whatsapp',
  'telegram',
  'slack',
  'feishu',
  'discord',
  'dingtalk',
  'email',
  'mochat',
  'qq',
];

export const CHANNEL_LABELS: Record<ChannelName, string> = {
  whatsapp: 'WhatsApp',
  telegram: 'Telegram',
  slack: 'Slack',
  feishu: 'Feishu',
  discord: 'Discord',
  dingtalk: 'DingTalk',
  email: 'Email',
  mochat: 'Mochat',
  qq: 'QQ',
};

export function isChannelName(value: string): value is ChannelName {
  for (const channel of SUPPORTED_CHANNELS) {
    if (channel === value) return true;
  }
  return false;
}
