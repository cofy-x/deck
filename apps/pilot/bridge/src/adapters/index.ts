/**
 * @license
 * Copyright 2025 cofy-x
 * SPDX-License-Identifier: Apache-2.0
 */

export { createTelegramAdapter } from './socket/telegram.js';
export type { TelegramAdapter } from './socket/telegram.js';

export {
  createWhatsAppAdapter,
} from './socket/whatsapp/whatsapp-adapter.js';
export type {
  WhatsAppAdapter,
  WhatsAppAdapterOptions,
} from './socket/whatsapp/whatsapp-adapter.js';
export { loginWhatsApp, unpairWhatsApp } from './socket/whatsapp/whatsapp-login.js';

export {
  closeWhatsAppSocket,
  createWhatsAppSocket,
  getStatusCode,
  hasWhatsAppCreds,
  waitForWhatsAppConnection,
} from './socket/whatsapp/whatsapp-session.js';
export type {
  CreateSocketOptions,
  WhatsAppSocket,
} from './socket/whatsapp/whatsapp-session.js';

export {
  createSlackAdapter,
  formatSlackPeerId,
  parseSlackPeerId,
  stripSlackMention,
} from './socket/slack.js';
export type { SlackAdapter, SlackDeps, SlackPeer } from './socket/slack.js';

export { createFeishuAdapter } from './webhook/feishu.js';
export type { FeishuAdapter } from './webhook/feishu.js';

export { createDiscordAdapter } from './socket/discord.js';
export type { DiscordAdapter, DiscordDeps } from './socket/discord.js';

export { createDingTalkAdapter } from './webhook/dingtalk.js';
export type { DingTalkAdapter } from './webhook/dingtalk.js';

export { createEmailAdapter } from './polling/email.js';
export type { EmailAdapter } from './polling/email.js';

export { createMochatAdapter } from './polling/mochat.js';
export type { MochatAdapter } from './polling/mochat.js';

export { createQqAdapter } from './webhook/qq.js';
export type { QqAdapter } from './webhook/qq.js';

export { ADAPTER_REGISTRY, CHANNEL_LABELS } from './registry.js';
export type { AdapterRegistration } from './registry.js';
