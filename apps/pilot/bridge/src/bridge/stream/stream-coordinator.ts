/**
 * @license
 * Copyright 2026 cofy-x
 * SPDX-License-Identifier: Apache-2.0
 */

import type {
  ChannelName,
  MessageInfo,
  MessagePartDeltaProps,
  MessagePartStreamProps,
} from '../../types/index.js';

export interface StreamFinalizeInput {
  sessionID: string;
  peerId: string;
  text: string;
}

export interface StreamCoordinator {
  onMessageUpdated(info?: MessageInfo): void;
  onMessagePartDelta(props?: MessagePartDeltaProps): Promise<void>;
  onMessagePartUpdated(props?: MessagePartStreamProps): Promise<void>;
  onSessionIdle(sessionID: string): Promise<void>;
  finalizeReply(input: StreamFinalizeInput): Promise<boolean>;
  hasStreamedMessage(sessionID: string): boolean;
  clearSession(sessionID: string): void;
}

export class NoopStreamCoordinator implements StreamCoordinator {
  onMessageUpdated(_info?: MessageInfo): void {
    return;
  }

  async onMessagePartDelta(_props?: MessagePartDeltaProps): Promise<void> {
    return;
  }

  async onMessagePartUpdated(_props?: MessagePartStreamProps): Promise<void> {
    return;
  }

  async onSessionIdle(_sessionID: string): Promise<void> {
    return;
  }

  async finalizeReply(_input: StreamFinalizeInput): Promise<boolean> {
    return false;
  }

  hasStreamedMessage(_sessionID: string): boolean {
    return false;
  }

  clearSession(_sessionID: string): void {
    return;
  }
}

const NOOP_COORDINATOR = new NoopStreamCoordinator();

export interface StreamCoordinatorRegistry {
  get(channel: ChannelName): StreamCoordinator;
}

export class MapStreamCoordinatorRegistry implements StreamCoordinatorRegistry {
  private readonly coordinators: Map<ChannelName, StreamCoordinator>;

  constructor(coordinators: Map<ChannelName, StreamCoordinator>) {
    this.coordinators = coordinators;
  }

  get(channel: ChannelName): StreamCoordinator {
    return this.coordinators.get(channel) ?? NOOP_COORDINATOR;
  }
}
