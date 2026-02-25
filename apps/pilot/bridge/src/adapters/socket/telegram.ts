/**
 * @license
 * Copyright 2025 cofy-x
 * SPDX-License-Identifier: Apache-2.0
 */

import { Bot } from 'grammy';
import type { BotError, Context } from 'grammy';
import type { Logger } from 'pino';

import type { Adapter, Config, MessageHandler } from '../../types/index.js';
import { createProxyAgent, resolveProxyUrl } from '../../utils.js';

export interface TelegramAdapter extends Adapter {
  name: 'telegram';
}

const MAX_TEXT_LENGTH = 4096;

export function createTelegramAdapter(
  config: Config,
  logger: Logger,
  onMessage: MessageHandler,
): TelegramAdapter {
  if (!config.telegramToken) {
    throw new Error('TELEGRAM_BOT_TOKEN is required for Telegram adapter');
  }

  const telegramApiUrl = 'https://api.telegram.org';
  const proxyUrl = resolveProxyUrl(telegramApiUrl);
  const agent = createProxyAgent(telegramApiUrl);
  if (proxyUrl) {
    logger.info({ proxy: proxyUrl }, 'telegram using proxy');
  }

  logger.debug({ tokenPresent: true }, 'telegram adapter init');
  const bot = new Bot(config.telegramToken, {
    client: agent
      ? {
          baseFetchConfig: { agent },
        }
      : undefined,
  });

  bot.catch((err: BotError<Context>) => {
    logger.error({ error: err.error }, 'telegram bot error');
  });

  let started = false;
  let pollingPromise: Promise<void> | null = null;

  bot.on('message', async (ctx: Context) => {
    const msg = ctx.message;
    if (!msg?.chat) return;

    const chatType = msg.chat.type as string;
    const isGroup =
      chatType === 'group' ||
      chatType === 'supergroup' ||
      chatType === 'channel';

    if (isGroup && !config.groupsEnabled) {
      logger.debug(
        { chatId: msg.chat.id, chatType },
        'telegram message ignored (groups disabled)',
      );
      return;
    }

    let text = msg.text ?? msg.caption ?? '';
    if (!text.trim()) return;

    if (isGroup) {
      const botUsername = ctx.me?.username;
      if (!botUsername) {
        logger.debug(
          { chatId: msg.chat.id },
          'telegram message ignored (bot username unknown)',
        );
        return;
      }

      const mentionPattern = new RegExp(`@${botUsername}\\b`, 'i');
      if (!mentionPattern.test(text)) {
        logger.debug(
          { chatId: msg.chat.id, botUsername },
          'telegram message ignored (not mentioned)',
        );
        return;
      }

      text = text.replace(mentionPattern, '').trim();
      if (!text) {
        logger.debug(
          { chatId: msg.chat.id },
          'telegram message ignored (empty after removing mention)',
        );
        return;
      }
    }

    logger.debug(
      {
        chatId: msg.chat.id,
        chatType,
        isGroup,
        length: text.length,
        preview: text.slice(0, 120),
      },
      'telegram message received',
    );

    try {
      await onMessage({
        channel: 'telegram',
        peerId: String(msg.chat.id),
        text,
        raw: msg,
      });
    } catch (error) {
      logger.error(
        { error, peerId: msg.chat.id },
        'telegram inbound handler failed',
      );
    }
  });

  return {
    name: 'telegram',
    maxTextLength: MAX_TEXT_LENGTH,
    capabilities: {
      progress: true,
      typing: true,
      file: false,
    },
    async start() {
      if (started) return;
      started = true;
      logger.debug('telegram adapter starting');
      await bot.init();
      pollingPromise = bot.start().catch((error) => {
        logger.error({ error }, 'telegram polling stopped unexpectedly');
        started = false;
      });
      logger.info('telegram adapter started');
    },
    async stop() {
      if (!started) return;
      started = false;
      await bot.stop();
      if (pollingPromise) {
        await pollingPromise.catch(() => undefined);
        pollingPromise = null;
      }
      logger.info('telegram adapter stopped');
    },
    async sendText(peerId: string, text: string) {
      await bot.api.sendMessage(Number(peerId), text);
    },
    async sendTextProgress(peerId: string, text: string, options = {}) {
      const chatId = Number(peerId);
      const messageId = options.messageId;
      if (messageId) {
        try {
          await bot.api.editMessageText(chatId, messageId, text);
          return { messageId };
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          if (message.toLowerCase().includes('message is not modified')) {
            return { messageId };
          }
          logger.warn({ error, peerId, messageId }, 'telegram stream edit failed');
          throw error;
        }
      }
      const sent = await bot.api.sendMessage(chatId, text);
      return { messageId: sent.message_id };
    },
    async sendTyping(peerId: string) {
      await bot.api.sendChatAction(Number(peerId), 'typing');
    },
  };
}
