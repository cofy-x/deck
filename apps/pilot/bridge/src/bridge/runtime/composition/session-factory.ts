/**
 * @license
 * Copyright 2026 cofy-x
 * SPDX-License-Identifier: Apache-2.0
 */

import type { Logger } from 'pino';

import type { BridgeStore } from '../../../db.js';
import { buildPermissionRules } from '../../../opencode.js';
import type { OpencodeClient } from '../../../opencode.js';
import type {
  Config,
  InboundMessage,
  SendTextFn,
} from '../../../types/index.js';
import { CHANNEL_LABELS } from '../../support/constants.js';
import { formatPeer } from '../../support/run-reporting.js';

export interface CreateSessionOptions {
  announce?: boolean;
  reason?: 'initial' | 'recovery';
}

export interface SessionFactoryDeps {
  client: OpencodeClient;
  config: Config;
  store: BridgeStore;
  logger: Logger;
  sendText: SendTextFn;
  reportStatus?: (message: string) => void;
}

export class SessionFactory {
  constructor(private readonly deps: SessionFactoryDeps) {}

  async create(
    message: InboundMessage,
    options: CreateSessionOptions = {},
  ): Promise<string> {
    const announce = options.announce ?? true;
    const title = `bridge ${message.channel} ${message.peerId}`;
    const session = await this.deps.client.session.create<true>(
      {
        title,
        permission: buildPermissionRules(this.deps.config.permissionMode),
      },
      { throwOnError: true },
    );

    const sessionID = session.data.id;
    if (!sessionID) throw new Error('Failed to create session');

    this.deps.store.upsertSession(message.channel, message.peerId, sessionID);
    this.deps.logger.info(
      {
        sessionID,
        channel: message.channel,
        peerId: message.peerId,
        reason: options.reason ?? 'initial',
      },
      'session created',
    );

    if (announce) {
      this.deps.reportStatus?.(
        `${CHANNEL_LABELS[message.channel]} session created for ${formatPeer(message.channel, message.peerId)} (ID: ${sessionID}).`,
      );
      await this.deps.sendText(
        message.channel,
        message.peerId,
        '\u{1F9ED} Session started.',
        { kind: 'system' },
      );
    }

    return sessionID;
  }
}
