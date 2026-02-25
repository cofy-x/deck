/**
 * @license
 * Copyright 2026 cofy-x
 * SPDX-License-Identifier: Apache-2.0
 */

import type { Logger } from 'pino';

import type { BridgeStore } from '../../db.js';
import type {
  ChannelName,
  Config,
  InboundMessage,
  SendTextFn,
} from '../../types/index.js';

export interface AccessControlServiceDeps {
  config: Config;
  logger: Logger;
  store: BridgeStore;
  sendText: SendTextFn;
}

export interface AllowInboundInput {
  accessKey: string;
}

const PAIRING_TTL_MS = 60 * 60_000;
const PAIRING_QUEUE_LIMIT = 3;
const PAIRING_SUPPORTED_CHANNELS = new Set<ChannelName>([
  'whatsapp',
  'telegram',
  'slack',
  'discord',
  'email',
  'qq',
]);

export class AccessControlService {
  constructor(private readonly deps: AccessControlServiceDeps) {}

  async allowInbound(
    message: InboundMessage,
    input: AllowInboundInput,
  ): Promise<boolean> {
    const policy = this.deps.config.channelAccessPolicy[message.channel];
    const isSelf = Boolean(
      message.channel === 'whatsapp' &&
        message.fromMe &&
        this.deps.config.whatsappSelfChatMode,
    );
    const allowAll = Boolean(
      message.channel === 'whatsapp' &&
        this.deps.config.whatsappAllowFrom.has('*'),
    );
    const allowed =
      allowAll ||
      isSelf ||
      this.isAllowed(message.channel, input.accessKey);

    this.deps.logger.debug(
      {
        channel: message.channel,
        policy,
        accessKey: input.accessKey,
        allowAll,
        isSelf,
        allowed,
      },
      'channel access control check',
    );

    if (policy === 'open') {
      return true;
    }

    if (policy === 'disabled') {
      await this.sendDenied(message, policy);
      return false;
    }

    if (allowed) {
      return true;
    }

    if (policy === 'allowlist') {
      await this.sendDenied(message, policy);
      return false;
    }

    if (policy === 'pairing' && !PAIRING_SUPPORTED_CHANNELS.has(message.channel)) {
      this.deps.logger.warn(
        { channel: message.channel, policy },
        'pairing is not supported for this channel, fallback to allowlist',
      );
      await this.sendDenied(message, 'allowlist');
      return false;
    }

    this.deps.store.prunePairingRequests();
    const active = this.deps.store.getPairingRequest(
      message.channel,
      input.accessKey,
    );
    const pending = this.deps.store.listPairingRequests(message.channel);
    if (!active && pending.length >= PAIRING_QUEUE_LIMIT) {
      await this.deps.sendText(
        message.channel,
        message.peerId,
        'Pairing queue full. Ask the owner to approve pending requests.',
        { kind: 'system' },
      );
      return false;
    }

    const code =
      active?.code ?? String(Math.floor(100000 + Math.random() * 900000));
    if (!active) {
      this.deps.store.createPairingRequest(
        message.channel,
        input.accessKey,
        code,
        PAIRING_TTL_MS,
      );
    }
    await this.deps.sendText(
      message.channel,
      message.peerId,
      `Pairing required. Ask the owner to approve code: ${code}`,
      { kind: 'system' },
    );
    return false;
  }

  private isAllowed(channel: ChannelName, accessKey: string): boolean {
    return this.deps.store.isAllowed(channel, accessKey);
  }

  private async sendDenied(
    message: InboundMessage,
    policy: 'allowlist' | 'disabled',
  ): Promise<void> {
    if (message.channel === 'whatsapp' && policy === 'allowlist') {
      await this.deps.sendText(
        message.channel,
        message.peerId,
        'Access denied. Ask the owner to allowlist your number.',
        { kind: 'system' },
      );
      return;
    }
    await this.deps.sendText(message.channel, message.peerId, 'Access denied.', {
      kind: 'system',
    });
  }
}
