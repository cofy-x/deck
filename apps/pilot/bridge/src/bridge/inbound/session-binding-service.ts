/**
 * @license
 * Copyright 2026 cofy-x
 * SPDX-License-Identifier: Apache-2.0
 */

import type { Logger } from 'pino';

import type { BridgeStore } from '../../db.js';
import type {
  Config,
  InboundMessage,
  ModelRef,
  RunState,
} from '../../types/index.js';
import { createRunState } from '../state/run-state.js';
import { reportDone, reportThinking } from '../support/run-reporting.js';
import type { SessionRunRegistry } from '../state/session-run-registry.js';
import type { StreamCoordinatorRegistry } from '../stream/stream-coordinator.js';
import type { TypingManager } from '../stream/typing-manager.js';

export interface SessionBindingServiceDeps {
  config: Config;
  logger: Logger;
  store: BridgeStore;
  runRegistry: SessionRunRegistry;
  typingManager: TypingManager;
  streamCoordinatorRegistry: StreamCoordinatorRegistry;
  sessionModels: Map<string, ModelRef>;
  createSession: (
    message: InboundMessage,
    options?: { announce?: boolean; reason?: 'initial' | 'recovery' },
  ) => Promise<string>;
  reportStatus?: (message: string) => void;
}

export interface ResolvedSession {
  sessionID: string;
  reused: boolean;
}

export interface SessionRunBindingInput {
  message: InboundMessage;
  sessionID: string;
}

export class SessionRunBinding {
  private activeSessionID: string;

  readonly runState: RunState;

  constructor(
    private readonly deps: SessionBindingServiceDeps,
    private readonly input: SessionRunBindingInput,
  ) {
    this.activeSessionID = input.sessionID;
    this.runState = createRunState({
      sessionID: input.sessionID,
      channel: input.message.channel,
      peerId: input.message.peerId,
      toolUpdatesEnabled: deps.config.toolUpdatesEnabled,
    });
  }

  get currentSessionID(): string {
    return this.activeSessionID;
  }

  initialize(): void {
    this.deps.runRegistry.set(this.runState);
    reportThinking(this.runState, this.deps.sessionModels, this.deps.reportStatus);
    this.deps.typingManager.start(this.runState);
  }

  rebind(nextSessionID: string): void {
    if (!nextSessionID || nextSessionID === this.activeSessionID) return;
    const previousSessionID = this.activeSessionID;

    this.deps.runRegistry.delete(previousSessionID);
    this.deps.typingManager.stop(previousSessionID);
    this.deps.streamCoordinatorRegistry
      .get(this.runState.channel)
      .clearSession(previousSessionID);

    this.activeSessionID = nextSessionID;
    this.runState.sessionID = nextSessionID;
    this.deps.runRegistry.set(this.runState);
    reportThinking(this.runState, this.deps.sessionModels, this.deps.reportStatus);
    this.deps.typingManager.start(this.runState);
  }

  finalize(): void {
    this.deps.typingManager.stop(this.activeSessionID);
    this.deps.streamCoordinatorRegistry
      .get(this.runState.channel)
      .clearSession(this.runState.sessionID);
    reportDone(this.runState, this.deps.sessionModels, this.deps.reportStatus);
    this.deps.runRegistry.delete(this.activeSessionID);

    if (this.activeSessionID === this.input.sessionID) return;

    this.deps.typingManager.stop(this.input.sessionID);
    this.deps.streamCoordinatorRegistry
      .get(this.runState.channel)
      .clearSession(this.input.sessionID);
    this.deps.runRegistry.delete(this.input.sessionID);
  }
}

export class SessionBindingService {
  constructor(private readonly deps: SessionBindingServiceDeps) {}

  async resolveSession(
    message: InboundMessage,
    peerKey: string,
  ): Promise<ResolvedSession> {
    const session = this.deps.store.getSession(message.channel, peerKey);
    const sessionID =
      session?.session_id ??
      (await this.deps.createSession({ ...message, peerId: peerKey }));

    this.deps.logger.debug(
      {
        sessionID,
        channel: message.channel,
        peerId: message.peerId,
        reused: Boolean(session?.session_id),
      },
      'session resolved',
    );

    return {
      sessionID,
      reused: Boolean(session?.session_id),
    };
  }

  createRunBinding(input: SessionRunBindingInput): SessionRunBinding {
    return new SessionRunBinding(this.deps, input);
  }
}
