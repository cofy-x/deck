/**
 * @license
 * Copyright 2026 cofy-x
 * SPDX-License-Identifier: Apache-2.0
 */

import type { Logger } from 'pino';

import { chunkText } from '../../text.js';
import type {
  Adapter,
  BridgeReporter,
  ChannelName,
  OutboundKind,
  SendTextFn,
} from '../../types/index.js';

export class OutboundDispatcher {
  constructor(
    private readonly adapters: Map<ChannelName, Adapter>,
    private readonly logger: Logger,
    private readonly reporter?: BridgeReporter,
  ) {}

  readonly sendText: SendTextFn = async (
    channel,
    peerId,
    text,
    options = {},
  ) => {
    const adapter = this.adapters.get(channel);
    if (!adapter) return;
    const kind: OutboundKind = options.kind ?? 'system';
    this.logger.debug(
      { channel, peerId, kind, length: text.length },
      'sendText requested',
    );
    if (options.display !== false) {
      this.reporter?.onOutbound?.({ channel, peerId, text, kind });
    }

    if (text.startsWith('FILE:')) {
      const filePath = text.substring(5).trim();
      const supportsFile = adapter.capabilities.file || Boolean(adapter.sendFile);
      if (supportsFile && adapter.sendFile) {
        await adapter.sendFile(peerId, filePath);
        return;
      }
    }

    const chunks = chunkText(text, adapter.maxTextLength);
    for (const chunk of chunks) {
      this.logger.info({ channel, peerId, length: chunk.length }, 'sending message');
      await adapter.sendText(peerId, chunk);
    }
  };
}
