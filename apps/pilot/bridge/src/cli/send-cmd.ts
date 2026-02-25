/**
 * @license
 * Copyright 2025 cofy-x
 * SPDX-License-Identifier: Apache-2.0
 */

import type { Command } from 'commander';
import { Bot } from 'grammy';
import { WebClient } from '@slack/web-api';

import {
  createDingTalkAdapter,
  createDiscordAdapter,
  createEmailAdapter,
  createFeishuAdapter,
  createMochatAdapter,
  createQqAdapter,
  createWhatsAppAdapter,
  parseSlackPeerId,
  type WhatsAppAdapter,
} from '../adapters/index.js';
import {
  CHANNEL_LABELS,
  isChannelName,
  SUPPORTED_CHANNELS,
} from '../channel-meta.js';
import { loadConfig } from '../config.js';
import type { ChannelName } from '../types/index.js';
import { createAppLogger, outputJson } from './helpers.js';
import { runCommand } from './command-runner.js';

interface SendOptions {
  channel: string;
  to: string;
  message: string;
}

type BridgeConfig = ReturnType<typeof loadConfig>;

async function sendViaWhatsApp(to: string, message: string, config: BridgeConfig) {
  const logger = createAppLogger(config);
  console.warn(
    'Note: This creates a separate WhatsApp connection. If the bridge is running, it will be temporarily disconnected.',
  );

  let resolveConnected: (() => void) | null = null;
  let rejectConnected: ((error: Error) => void) | null = null;
  const connectedPromise = new Promise<void>((resolve, reject) => {
    resolveConnected = resolve;
    rejectConnected = reject;
  });
  const timeout = setTimeout(() => {
    rejectConnected?.(new Error('WhatsApp connection timed out (30s)'));
  }, 30_000);

  const adapter: WhatsAppAdapter = createWhatsAppAdapter(
    config,
    logger,
    async () => {},
    {
      printQr: false,
      onStatus: (status) => {
        console.log(`${status}`);
        if (status === 'WhatsApp connected.') {
          clearTimeout(timeout);
          resolveConnected?.();
        }
      },
    },
  );
  await adapter.start().catch((error) => {
    clearTimeout(timeout);
    throw error;
  });
  await connectedPromise;

  let peerId = to.trim();
  if (!peerId.includes('@')) {
    const cleaned = peerId.startsWith('+') ? peerId.slice(1) : peerId;
    peerId = `${cleaned}@s.whatsapp.net`;
  }

  await adapter.sendText(peerId, message);
  await adapter.stop();
  return peerId;
}

async function sendViaTelegram(to: string, message: string, config: BridgeConfig) {
  if (!config.telegramToken) {
    throw new Error(
      "Telegram bot token not configured. Use 'bridge telegram set-token <token>' first.",
    );
  }
  const bot = new Bot(config.telegramToken);
  await bot.api.sendMessage(Number(to), message);
}

async function sendViaSlack(to: string, message: string, config: BridgeConfig) {
  if (!config.slackBotToken) {
    throw new Error(
      "Slack bot token not configured. Use 'bridge slack set-tokens <bot> <app>' first.",
    );
  }
  const web = new WebClient(config.slackBotToken);
  const peer = parseSlackPeerId(to);
  if (!peer.channelId) {
    throw new Error(
      'Invalid recipient for Slack. Use a channel ID (C..., D...) or encoded peerId (C...|threadTs)',
    );
  }
  await web.chat.postMessage({
    channel: peer.channelId,
    text: message,
    ...(peer.threadTs ? { thread_ts: peer.threadTs } : {}),
  });
}

async function sendViaFeishu(to: string, message: string, config: BridgeConfig) {
  const adapter = createFeishuAdapter(config, createAppLogger(config), async () => {});
  await adapter.sendText(to, message);
}

async function sendViaDiscord(to: string, message: string, config: BridgeConfig) {
  const adapter = createDiscordAdapter(config, createAppLogger(config), async () => {});
  await adapter.start();
  try {
    await adapter.sendText(to, message);
  } finally {
    await adapter.stop();
  }
}

async function sendViaDingTalk(to: string, message: string, config: BridgeConfig) {
  const adapter = createDingTalkAdapter(config, createAppLogger(config), async () => {});
  await adapter.sendText(to, message);
}

async function sendViaEmail(to: string, message: string, config: BridgeConfig) {
  const adapter = createEmailAdapter(config, createAppLogger(config), async () => {});
  await adapter.sendText(to, message);
}

async function sendViaMochat(to: string, message: string, config: BridgeConfig) {
  const adapter = createMochatAdapter(config, createAppLogger(config), async () => {});
  await adapter.sendText(to, message);
}

async function sendViaQq(to: string, message: string, config: BridgeConfig) {
  const adapter = createQqAdapter(config, createAppLogger(config), async () => {});
  await adapter.sendText(to, message);
}

type SendStrategyResult = {
  resolvedTo?: string;
};

type SendStrategy = (input: {
  to: string;
  message: string;
  config: BridgeConfig;
}) => Promise<SendStrategyResult>;

const SEND_STRATEGIES: Record<ChannelName, SendStrategy> = {
  whatsapp: async ({ to, message, config }) => ({
    resolvedTo: await sendViaWhatsApp(to, message, config),
  }),
  telegram: async ({ to, message, config }) => {
    await sendViaTelegram(to, message, config);
    return {};
  },
  slack: async ({ to, message, config }) => {
    await sendViaSlack(to, message, config);
    return {};
  },
  feishu: async ({ to, message, config }) => {
    await sendViaFeishu(to, message, config);
    return {};
  },
  discord: async ({ to, message, config }) => {
    await sendViaDiscord(to, message, config);
    return {};
  },
  dingtalk: async ({ to, message, config }) => {
    await sendViaDingTalk(to, message, config);
    return {};
  },
  email: async ({ to, message, config }) => {
    await sendViaEmail(to, message, config);
    return {};
  },
  mochat: async ({ to, message, config }) => {
    await sendViaMochat(to, message, config);
    return {};
  },
  qq: async ({ to, message, config }) => {
    await sendViaQq(to, message, config);
    return {};
  },
};

function requireChannel(channel: string): ChannelName {
  if (isChannelName(channel)) {
    return channel;
  }
  const expected = SUPPORTED_CHANNELS.join(', ');
  throw new Error(`Invalid channel: ${channel}. Must be one of: ${expected}.`);
}

export function registerSendCommand(program: Command) {
  program
    .command('send')
    .description('Send a test message')
    .requiredOption(
      '--channel <channel>',
      `Channel: ${SUPPORTED_CHANNELS.join(', ')}`,
    )
    .requiredOption('--to <recipient>', 'Recipient ID (platform-specific)')
    .requiredOption('--message <text>', 'Message text to send')
    .action((opts: SendOptions) =>
      runCommand(
        program,
        async ({ useJson }) => {
          const channel = requireChannel(opts.channel);
          const to = opts.to;
          const message = opts.message;
          const config = loadConfig(process.env, { requireOpencode: false });

          const strategy = SEND_STRATEGIES[channel];
          const result = await strategy({ to, message, config });
          const resolvedTo = result.resolvedTo ?? to;

          if (useJson) {
            outputJson({ success: true, channel, to: resolvedTo, message });
          } else {
            console.log(`Message sent to ${resolvedTo} via ${CHANNEL_LABELS[channel]}`);
          }
        },
        {
          errorPrefix: 'Failed to send message',
          includeStack: true,
        },
      ),
    );
}
