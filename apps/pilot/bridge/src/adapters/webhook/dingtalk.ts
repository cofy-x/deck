/**
 * @license
 * Copyright 2025 cofy-x
 * SPDX-License-Identifier: Apache-2.0
 */

import { createHmac } from 'node:crypto';
import type { IncomingHttpHeaders } from 'node:http';

import type { Logger } from 'pino';
import { z } from 'zod';

import type { Adapter, Config, MessageHandler } from '../../types/index.js';
import { parseJsonTextWithSchema } from '../../safe-json.js';
import type { HttpEventResponse } from '../common/http-event-server.js';
import { WebhookAdapterBase } from '../common/webhook-adapter-base.js';

export interface DingTalkAdapter extends Adapter {
  name: 'dingtalk';
}

interface DingTalkText {
  content?: string;
}

interface DingTalkPayload {
  conversationType?: string;
  conversationId?: string;
  senderStaffId?: string;
  senderId?: string;
  text?: DingTalkText;
  msgtype?: string;
  challenge?: string;
  token?: string;
}

const DingTalkPayloadSchema: z.ZodType<DingTalkPayload> = z
  .object({
    conversationType: z.string().optional(),
    conversationId: z.string().optional(),
    senderStaffId: z.string().optional(),
    senderId: z.string().optional(),
    text: z
      .object({
        content: z.string().optional(),
      })
      .optional(),
    msgtype: z.string().optional(),
    challenge: z.string().optional(),
    token: z.string().optional(),
  })
  .loose();

const MAX_TEXT_LENGTH = 12_000;

function buildSignedWebhookUrl(webhookUrl: string, signSecret: string): string {
  const timestamp = String(Date.now());
  const stringToSign = `${timestamp}\n${signSecret}`;
  const sign = createHmac('sha256', signSecret)
    .update(stringToSign, 'utf8')
    .digest('base64');
  const url = new URL(webhookUrl);
  url.searchParams.set('timestamp', timestamp);
  url.searchParams.set('sign', sign);
  return url.toString();
}

function readHeaderValue(
  headers: IncomingHttpHeaders,
  key: string,
): string | undefined {
  const value = headers[key];
  const normalized = Array.isArray(value) ? value[0] : value;
  return normalized?.trim() ? normalized.trim() : undefined;
}

export function extractVerificationToken(
  payload: DingTalkPayload,
  headers: IncomingHttpHeaders,
): string | undefined {
  return (
    readHeaderValue(headers, 'token') ||
    payload.token?.trim() ||
    undefined
  );
}

export function createDingTalkAdapter(
  config: Config,
  logger: Logger,
  onMessage: MessageHandler,
): DingTalkAdapter {
  const log = logger.child({ channel: 'dingtalk' });
  const webhookAdapter = new WebhookAdapterBase<DingTalkPayload>({
    channel: 'dingtalk',
    logger: log,
    port: config.dingtalkEventPort,
    path: config.dingtalkEventPath,
    parsePayload: (body) => {
      log.debug({ rawBody: body }, 'dingtalk inbound raw body');
      try {
        return {
          ok: true,
          payload: parseJsonTextWithSchema(
            body,
            DingTalkPayloadSchema,
            'dingtalk webhook payload',
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
    handlePayload: async (
      payload,
      headers,
    ): Promise<HttpEventResponse | null> => {
      log.debug({ payload }, 'dingtalk inbound payload parsed');

      if (typeof payload.challenge === 'string' && payload.challenge) {
        return { status: 200, body: { challenge: payload.challenge } };
      }

      const token = config.dingtalkVerificationToken?.trim();
      if (token) {
        const actualToken = extractVerificationToken(payload, headers);
        if (!actualToken || actualToken !== token) {
          log.warn(
            {
              hasHeaderToken: Boolean(readHeaderValue(headers, 'token')),
              hasPayloadToken: Boolean(payload.token?.trim()),
            },
            'dingtalk verification token mismatch',
          );
          return {
            status: 401,
            body: { ok: false, error: 'Invalid verification token' },
          };
        }
      }

      const text = payload.text?.content?.trim() ?? '';
      if (!text) return { status: 200, body: { ok: true } };

      const peerId =
        payload.senderStaffId?.trim() ||
        payload.senderId?.trim() ||
        payload.conversationId?.trim() ||
        '';
      if (!peerId) {
        return {
          status: 400,
          body: { ok: false, error: 'Missing sender id in payload' },
        };
      }

      await onMessage({
        channel: 'dingtalk',
        peerId,
        text,
        raw: payload,
      });

      return { status: 200, body: { ok: true } };
    },
  });

  return {
    name: 'dingtalk',
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
      if (!config.dingtalkWebhookUrl) {
        throw new Error(
          'DINGTALK_WEBHOOK_URL is required for outbound messages',
        );
      }
      const signSecret = config.dingtalkSignSecret?.trim();
      const endpoint = signSecret
        ? buildSignedWebhookUrl(config.dingtalkWebhookUrl, signSecret)
        : config.dingtalkWebhookUrl;
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          msgtype: 'text',
          text: { content: text },
        }),
      });

      if (!response.ok) {
        const body = await response.text();
        throw new Error(
          `DingTalk webhook send failed: ${response.status} ${body.slice(0, 200)}`,
        );
      }
    },
  };
}
