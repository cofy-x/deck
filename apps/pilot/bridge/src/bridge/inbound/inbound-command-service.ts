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
  SendTextFn,
} from '../../types/index.js';
import { handleCommand } from './commands.js';
import type { ModelStore } from '../state/model-store.js';

export interface InboundCommandServiceDeps {
  config: Config;
  store: BridgeStore;
  modelStore: ModelStore;
  logger: Logger;
  sendText: SendTextFn;
}

export class InboundCommandService {
  constructor(private readonly deps: InboundCommandServiceDeps) {}

  async maybeHandle(input: {
    channel: ChannelName;
    peerKey: string;
    replyPeerId: string;
    text: string;
  }): Promise<boolean> {
    return handleCommand(
      this.deps,
      input.channel,
      input.peerKey,
      input.replyPeerId,
      input.text,
    );
  }
}
