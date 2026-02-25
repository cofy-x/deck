/**
 * @license
 * Copyright 2026 cofy-x
 * SPDX-License-Identifier: Apache-2.0
 */

import type { IncomingHttpHeaders } from 'node:http';

import type { Logger } from 'pino';

import type { HttpEventResponse } from './http-event-server.js';
import { startHttpEventServer } from './http-event-server.js';

interface ParsedPayloadOk<TPayload> {
  ok: true;
  payload: TPayload;
}

interface ParsedPayloadError {
  ok: false;
  status: number;
  error: string;
}

type ParsedPayloadResult<TPayload> = ParsedPayloadOk<TPayload> | ParsedPayloadError;

export interface WebhookAdapterBaseOptions<TPayload> {
  channel: string;
  logger: Logger;
  port: number;
  path: string;
  parsePayload: (body: string) => ParsedPayloadResult<TPayload>;
  handlePayload: (
    payload: TPayload,
    headers: IncomingHttpHeaders,
  ) => Promise<HttpEventResponse | null>;
}

export class WebhookAdapterBase<TPayload> {
  private eventServer: { stop: () => Promise<void> } | null = null;

  constructor(private readonly options: WebhookAdapterBaseOptions<TPayload>) {}

  async start(): Promise<void> {
    if (this.eventServer) return;

    this.eventServer = startHttpEventServer({
      port: this.options.port,
      path: this.options.path,
      logger: this.options.logger,
      onRequest: async ({ body, headers }) => {
        const parsed = this.options.parsePayload(body);
        if (!parsed.ok) {
          return {
            status: parsed.status,
            body: { ok: false, error: parsed.error },
          };
        }

        const response = await this.options.handlePayload(parsed.payload, headers);
        return response ?? { status: 200, body: { ok: true } };
      },
    });

    this.options.logger.info(
      { port: this.options.port, path: this.options.path },
      `${this.options.channel} adapter started`,
    );
  }

  async stop(): Promise<void> {
    if (!this.eventServer) return;
    await this.eventServer.stop();
    this.eventServer = null;
    this.options.logger.info(`${this.options.channel} adapter stopped`);
  }
}
