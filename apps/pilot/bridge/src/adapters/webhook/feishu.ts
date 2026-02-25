/**
 * @license
 * Copyright 2025 cofy-x
 * SPDX-License-Identifier: Apache-2.0
 */

import type { Logger } from 'pino';
import { z } from 'zod';

import { parseJsonTextWithSchema } from '../../safe-json.js';
import type { Adapter, Config, MessageHandler } from '../../types/index.js';
import type { HttpEventResponse } from '../common/http-event-server.js';
import { WebhookAdapterBase } from '../common/webhook-adapter-base.js';

export interface FeishuAdapter extends Adapter {
  name: 'feishu';
}

interface FeishuMessageContentText {
  text?: string;
}

interface FeishuPostElement {
  tag?: string;
  text?: string;
}

interface FeishuEventPayload {
  challenge?: string;
  header?: {
    event_type?: string;
  };
  event?: {
    sender?: {
      sender_type?: string;
      sender_id?: {
        open_id?: string;
        user_id?: string;
      };
    };
    message?: {
      message_id?: string;
      chat_id?: string;
      message_type?: string;
      content?: string;
    };
  };
}

const FeishuMessageContentTextSchema: z.ZodType<FeishuMessageContentText> = z
  .object({
    text: z.string().optional(),
  })
  .loose();

const FeishuPostElementSchema: z.ZodType<FeishuPostElement> = z
  .object({
    tag: z.string().optional(),
    text: z.string().optional(),
  })
  .loose();

const FeishuPostContentSchema = z
  .object({
    zh_cn: z
      .object({
        content: z.array(z.array(FeishuPostElementSchema)).optional(),
      })
      .optional(),
  })
  .loose();

const FeishuEventPayloadSchema: z.ZodType<FeishuEventPayload> = z
  .object({
    challenge: z.string().optional(),
    header: z
      .object({
        event_type: z.string().optional(),
      })
      .optional(),
    event: z
      .object({
        sender: z
          .object({
            sender_type: z.string().optional(),
            sender_id: z
              .object({
                open_id: z.string().optional(),
                user_id: z.string().optional(),
              })
              .optional(),
          })
          .optional(),
        message: z
          .object({
            message_id: z.string().optional(),
            chat_id: z.string().optional(),
            message_type: z.string().optional(),
            content: z.string().optional(),
          })
          .optional(),
      })
      .optional(),
  })
  .loose();

const MAX_TEXT_LENGTH = 12_000;
const EVENT_TYPE_MESSAGE_RECEIVE = 'im.message.receive_v1';

function extractTextFromPost(contentRaw: string): string {
  try {
    const payload = parseJsonTextWithSchema(
      contentRaw,
      FeishuPostContentSchema,
      'feishu post content',
    );
    const content = payload.zh_cn?.content;
    if (!content) return '';
    const parts: string[] = [];
    for (const line of content) {
      for (const element of line) {
        if (element.tag === 'text' && element.text) {
          parts.push(element.text);
        }
      }
    }
    return parts.join(' ').trim();
  } catch {
    return '';
  }
}

function extractText(payload: FeishuEventPayload): string {
  const messageType = payload.event?.message?.message_type ?? 'text';
  const contentRaw = payload.event?.message?.content ?? '';
  if (!contentRaw) return '';

  if (messageType === 'text') {
    try {
      const content = parseJsonTextWithSchema(
        contentRaw,
        FeishuMessageContentTextSchema,
        'feishu text message content',
      );
      return content.text?.trim() ?? '';
    } catch {
      return '';
    }
  }

  if (messageType === 'post') {
    return extractTextFromPost(contentRaw);
  }

  return `[${messageType}]`;
}

export function createFeishuAdapter(
  config: Config,
  logger: Logger,
  onMessage: MessageHandler,
): FeishuAdapter {
  const log = logger.child({ channel: 'feishu' });
  const webhookAdapter = new WebhookAdapterBase<FeishuEventPayload>({
    channel: 'feishu',
    logger: log,
    port: config.feishuEventPort,
    path: config.feishuEventPath,
    parsePayload: (body) => {
      try {
        return {
          ok: true,
          payload: parseJsonTextWithSchema(
            body,
            FeishuEventPayloadSchema,
            'feishu webhook payload',
          ),
        };
      } catch {
        return {
          ok: false,
          status: 400,
          error: 'Invalid JSON payload',
        };
      }
    },
    handlePayload: async (payload): Promise<HttpEventResponse | null> => {
      if (typeof payload.challenge === 'string' && payload.challenge) {
        return {
          status: 200,
          body: { challenge: payload.challenge },
        };
      }

      if (payload.header?.event_type !== EVENT_TYPE_MESSAGE_RECEIVE) {
        return { status: 200, body: { ok: true } };
      }

      const senderType = payload.event?.sender?.sender_type;
      if (senderType === 'bot') {
        return { status: 200, body: { ok: true } };
      }

      const peerId = payload.event?.message?.chat_id?.trim();
      const senderId =
        payload.event?.sender?.sender_id?.open_id?.trim() ||
        payload.event?.sender?.sender_id?.user_id?.trim() ||
        '';
      const text = extractText(payload);
      if (!text) {
        return { status: 200, body: { ok: true } };
      }

      const resolvedPeerId = peerId || senderId;
      if (!resolvedPeerId) {
        return {
          status: 400,
          body: { ok: false, error: 'Missing peer id in event payload' },
        };
      }

      await onMessage({
        channel: 'feishu',
        peerId: resolvedPeerId,
        text,
        raw: payload,
      });

      return { status: 200, body: { ok: true } };
    },
  });

  return {
    name: 'feishu',
    maxTextLength: MAX_TEXT_LENGTH,
    capabilities: {
      progress: false,
      typing: false,
      file: false,
    },
    async start() {
      await webhookAdapter.start();
    },
    async stop() {
      await webhookAdapter.stop();
    },
    async sendText(_peerId: string, text: string) {
      if (!config.feishuWebhookUrl) {
        throw new Error('FEISHU_WEBHOOK_URL is required for outbound messages');
      }
      const response = await fetch(config.feishuWebhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          msg_type: 'text',
          content: {
            text,
          },
        }),
      });

      if (!response.ok) {
        const body = await response.text();
        throw new Error(
          `Feishu webhook send failed: ${response.status} ${body.slice(0, 200)}`,
        );
      }
    },
  };
}
