/**
 * @license
 * Copyright 2026 cofy-x
 * SPDX-License-Identifier: Apache-2.0
 */

import type { Logger } from 'pino';

import type {
  Adapter,
  ChannelName,
  MessageInfo,
  MessagePartDeltaProps,
  MessagePartStreamProps,
  RunState,
  TelegramRunState,
} from '../../types/index.js';
import type {
  StreamCoordinator,
  StreamFinalizeInput,
} from './stream-coordinator.js';
import {
  type ResolveRunOptions,
  resolveTelegramRun,
} from './telegram/guards.js';
import {
  type Scheduler,
  TelegramFlushEngine,
} from './telegram/flush-engine.js';
import {
  handleTelegramMessagePartDelta,
  handleTelegramMessagePartUpdated,
} from './telegram/part-handlers.js';
import { TelegramRoleIndex } from './telegram/role-index.js';
import { TelegramStreamStateStore } from './telegram/stream-state-store.js';

export type TelegramFinalizeInput = StreamFinalizeInput;

export interface TelegramStreamCoordinatorDeps {
  logger: Logger;
  activeRuns: Map<string, RunState>;
  adapters: Map<ChannelName, Adapter>;
  flushMs?: number;
  maxRoleEntriesPerSession?: number;
  scheduler?: Scheduler;
}

const DEFAULT_FLUSH_MS = 300;
const DEFAULT_MAX_ROLE_ENTRIES = 64;

export class TelegramStreamCoordinator implements StreamCoordinator {
  private readonly roleIndex: TelegramRoleIndex;

  private readonly stateStore = new TelegramStreamStateStore();

  private readonly flushEngine: TelegramFlushEngine;

  constructor(private readonly deps: TelegramStreamCoordinatorDeps) {
    this.roleIndex = new TelegramRoleIndex(
      deps.maxRoleEntriesPerSession ?? DEFAULT_MAX_ROLE_ENTRIES,
    );
    this.flushEngine = new TelegramFlushEngine({
      logger: deps.logger,
      adapters: deps.adapters,
      flushMs: deps.flushMs ?? DEFAULT_FLUSH_MS,
      stateStore: this.stateStore,
      resolveRun: this.resolveTelegramRun.bind(this),
      scheduler: deps.scheduler,
    });
  }

  onMessageUpdated(info?: MessageInfo): void {
    const sessionID = info?.sessionID;
    const messageID = info?.id;
    const role = info?.role;
    if (!sessionID || !messageID || !role) return;

    const run = this.resolveTelegramRun(sessionID);
    if (!run) return;

    this.roleIndex.remember(sessionID, messageID, role);
    const shouldFlush = this.stateStore.onRoleResolved(
      sessionID,
      messageID,
      role,
      this.resolveRole.bind(this),
    );
    if (shouldFlush) {
      this.flushEngine.markPending(sessionID);
    }
  }

  async onMessagePartDelta(props?: MessagePartDeltaProps): Promise<void> {
    await handleTelegramMessagePartDelta(props, {
      resolveRun: this.resolveTelegramRun.bind(this),
      resolveRole: this.resolveRole.bind(this),
      stateStore: this.stateStore,
      flushEngine: this.flushEngine,
    });
  }

  async onMessagePartUpdated(props?: MessagePartStreamProps): Promise<void> {
    await handleTelegramMessagePartUpdated(props, {
      resolveRun: this.resolveTelegramRun.bind(this),
      resolveRole: this.resolveRole.bind(this),
      stateStore: this.stateStore,
      flushEngine: this.flushEngine,
    });
  }

  async onSessionIdle(sessionID: string): Promise<void> {
    await this.flushEngine.onSessionIdle(sessionID);
  }

  async finalizeReply(input: TelegramFinalizeInput): Promise<boolean> {
    return this.flushEngine.finalizeReply(input);
  }

  hasStreamedMessage(sessionID: string): boolean {
    return this.flushEngine.hasStreamedMessage(sessionID);
  }

  clearSession(sessionID: string): void {
    this.roleIndex.clearSession(sessionID);
    this.flushEngine.clearSession(sessionID);
  }

  private resolveTelegramRun(
    sessionID: string,
    options: ResolveRunOptions = {},
  ): TelegramRunState | null {
    return resolveTelegramRun(this.deps.activeRuns, sessionID, options);
  }

  private resolveRole(sessionID: string, messageID: string): string | undefined {
    return this.roleIndex.resolve(sessionID, messageID);
  }
}

export function createTelegramStreamCoordinator(
  deps: TelegramStreamCoordinatorDeps,
): TelegramStreamCoordinator {
  return new TelegramStreamCoordinator(deps);
}
