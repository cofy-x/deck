/**
 * @license
 * Copyright 2025 cofy-x
 * SPDX-License-Identifier: Apache-2.0
 */

import type { Logger } from 'pino';
import { z } from 'zod';

import type { Adapter, Config, MessageHandler } from '../../types/index.js';
import { parseJsonTextWithSchema } from '../../safe-json.js';
import type { HttpEventResponse } from '../common/http-event-server.js';
import { WebhookAdapterBase } from '../common/webhook-adapter-base.js';

export interface QqAdapter extends Adapter {
  name: 'qq';
}

interface QqInboundPayload {
  post_type?: string;
  message_type?: string;
  user_id?: number | string;
  raw_message?: string;
  message?: string;
  self_id?: number | string;
}

const QqInboundPayloadSchema: z.ZodType<QqInboundPayload> = z
  .object({
    post_type: z.string().optional(),
    message_type: z.string().optional(),
    user_id: z.union([z.number(), z.string()]).optional(),
    raw_message: z.string().optional(),
    message: z.string().optional(),
    self_id: z.union([z.number(), z.string()]).optional(),
  })
  .loose();

const MAX_TEXT_LENGTH = 4_000;

export function createQqAdapter(
  config: Config,
  logger: Logger,
  onMessage: MessageHandler,
): QqAdapter {
  const log = logger.child({ channel: 'qq' });
  const webhookAdapter = new WebhookAdapterBase<QqInboundPayload>({
    channel: 'qq',
    logger: log,
    port: config.qqWebhookPort,
    path: config.qqWebhookPath,
    parsePayload: (body) => {
      try {
        return {
          ok: true,
          payload: parseJsonTextWithSchema(
            body,
            QqInboundPayloadSchema,
            'qq webhook payload',
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
      if (payload.post_type !== 'message') {
        return { status: 200, body: { ok: true } };
      }

      const text = payload.raw_message?.trim() || payload.message?.trim() || '';
      if (!text) {
        return { status: 200, body: { ok: true } };
      }

      const peerId =
        typeof payload.user_id === 'number' || typeof payload.user_id === 'string'
          ? String(payload.user_id)
          : '';
      if (!peerId) {
        return {
          status: 400,
          body: { ok: false, error: 'Missing QQ user_id in payload' },
        };
      }

      await onMessage({
        channel: 'qq',
        peerId,
        text,
        raw: payload,
      });
      return { status: 200, body: { ok: true } };
    },
  });

  return {
    name: 'qq',
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
    async sendText(peerId: string, text: string) {
      const endpoint = `${config.qqApiBaseUrl.replace(/\/$/, '')}/send_private_msg`;
      const numericUserId = Number(peerId);
      const userId: number | string = Number.isFinite(numericUserId)
        ? numericUserId
        : peerId;
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (config.qqAccessToken) {
        headers['Authorization'] = `Bearer ${config.qqAccessToken}`;
      }

      const response = await fetch(endpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          user_id: userId,
          message: text,
        }),
      });

      if (!response.ok) {
        const body = await response.text();
        throw new Error(
          `QQ send failed: ${response.status} ${body.slice(0, 200)}`,
        );
      }
    },
  };
}
