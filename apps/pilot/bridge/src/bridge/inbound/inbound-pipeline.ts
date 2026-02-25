/**
 * @license
 * Copyright 2026 cofy-x
 * SPDX-License-Identifier: Apache-2.0
 */

import type { Logger } from 'pino';

import type { BridgeStore } from '../../db.js';
import { truncateText } from '../../text.js';
import type {
  Adapter,
  BridgeReporter,
  ChannelName,
  Config,
  InboundMessage,
  SendTextFn,
} from '../../types/index.js';
import type { ModelStore } from '../state/model-store.js';
import type { AccessControlService } from './access-control-service.js';
import type { InboundCommandService } from './inbound-command-service.js';
import type { RunExecutionService } from './run-execution-service.js';
import type { SessionBindingService } from './session-binding-service.js';
import type { SessionRunRegistry } from '../state/session-run-registry.js';
import type { TelegramInboundDeduper } from './telegram-inbound-deduper.js';
import { resolveAccessIdentity } from './access-identity.js';

export interface InboundPipelineDeps {
  config: Config;
  logger: Logger;
  adapters: Map<ChannelName, Adapter>;
  store: BridgeStore;
  modelStore: ModelStore;
  runRegistry: SessionRunRegistry;
  accessControlService: AccessControlService;
  inboundCommandService: InboundCommandService;
  sessionBindingService: SessionBindingService;
  runExecutionService: RunExecutionService;
  telegramInboundDeduper: TelegramInboundDeduper;
  sendText: SendTextFn;
  reporter?: BridgeReporter;
}

export class InboundPipeline {
  constructor(private readonly deps: InboundPipelineDeps) {}

  async handleInbound(message: InboundMessage): Promise<void> {
    const adapter = this.deps.adapters.get(message.channel);
    if (!adapter) return;

    if (this.deps.telegramInboundDeduper.isDuplicate(message)) {
      this.deps.logger.debug(
        { channel: message.channel, peerId: message.peerId },
        'duplicate telegram inbound ignored',
      );
      return;
    }

    this.deps.logger.debug(
      {
        channel: message.channel,
        peerId: message.peerId,
        fromMe: message.fromMe,
        length: message.text.length,
        preview: truncateText(message.text.trim(), 120),
      },
      'inbound received',
    );
    this.deps.logger.info(
      {
        channel: message.channel,
        peerId: message.peerId,
        length: message.text.length,
      },
      'received message',
    );

    const identity = resolveAccessIdentity(message);
    const allowed = await this.deps.accessControlService.allowInbound(message, {
      accessKey: identity.accessKey,
    });
    if (!allowed) {
      return;
    }

    const trimmedText = message.text.trim();
    if (trimmedText.startsWith('/')) {
      const commandHandled = await this.deps.inboundCommandService.maybeHandle({
        channel: message.channel,
        peerKey: identity.sessionKey,
        replyPeerId: message.peerId,
        text: trimmedText,
      });
      if (commandHandled) return;
    }

    this.deps.reporter?.onInbound?.({
      channel: message.channel,
      peerId: message.peerId,
      text: message.text,
      fromMe: message.fromMe,
    });

    const resolvedSession = await this.deps.sessionBindingService.resolveSession(
      message,
      identity.sessionKey,
    );

    this.deps.runRegistry.enqueue(resolvedSession.sessionID, async () => {
      await this.deps.runExecutionService.execute({
        message,
        peerKey: identity.sessionKey,
        sessionID: resolvedSession.sessionID,
      });
    });
  }

  async dispatchInbound(message: InboundMessage): Promise<void> {
    await this.handleInbound(message);
    const identity = resolveAccessIdentity(message);
    const session = this.deps.store.getSession(
      message.channel,
      identity.sessionKey,
    );
    const sessionID = session?.session_id;
    const pending = sessionID
      ? this.deps.runRegistry.getPendingTask(sessionID)
      : undefined;
    if (pending) {
      await pending;
    }
  }
}
