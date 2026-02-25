/**
 * @license
 * Copyright 2026 cofy-x
 * SPDX-License-Identifier: Apache-2.0
 */

import type { Logger } from 'pino';

import type {
  Adapter,
  ChannelName,
  TelegramRunState,
} from '../../../types/index.js';
import type { StreamFinalizeInput } from '../stream-coordinator.js';
import type { ResolveRunOptions } from './guards.js';
import type { TelegramStreamStateStore } from './stream-state-store.js';

export interface Scheduler {
  setTimeout(
    callback: () => void,
    delayMs: number,
  ): ReturnType<typeof setTimeout>;
  clearTimeout(timeout: ReturnType<typeof setTimeout>): void;
}

const DEFAULT_SCHEDULER: Scheduler = {
  setTimeout: (callback, delayMs) => setTimeout(callback, delayMs),
  clearTimeout: (timeout) => clearTimeout(timeout),
};

export interface TelegramFlushEngineDeps {
  logger: Logger;
  adapters: Map<ChannelName, Adapter>;
  flushMs: number;
  stateStore: TelegramStreamStateStore;
  resolveRun: (
    sessionID: string,
    options?: ResolveRunOptions,
  ) => TelegramRunState | null;
  scheduler?: Scheduler;
}

export class TelegramFlushEngine {
  private readonly scheduler: Scheduler;

  private readonly sessionLocks = new Map<string, Promise<void>>();

  constructor(private readonly deps: TelegramFlushEngineDeps) {
    this.scheduler = deps.scheduler ?? DEFAULT_SCHEDULER;
  }

  markPending(sessionID: string): void {
    const state = this.deps.stateStore.get(sessionID);
    if (!state) return;
    state.pending = true;
    this.scheduleFlush(sessionID);
  }

  async onSessionIdle(sessionID: string): Promise<void> {
    await this.flush(sessionID, true);
  }

  hasStreamedMessage(sessionID: string): boolean {
    const state = this.deps.stateStore.get(sessionID);
    return typeof state?.messageId === 'number';
  }

  clearSession(sessionID: string): void {
    this.clearTimer(sessionID);
    this.sessionLocks.delete(sessionID);
    this.deps.stateStore.clearSession(sessionID);
  }

  async finalizeReply(input: StreamFinalizeInput): Promise<boolean> {
    return this.runSerialized(input.sessionID, async () => {
      const run = this.deps.resolveRun(input.sessionID);
      if (!run) return false;

      const text = input.text.trim();
      if (!text) return false;

      await this.flushNow(input.sessionID, true);

      const state = this.deps.stateStore.get(input.sessionID);
      const messageId = state?.messageId;
      const adapter = this.deps.adapters.get('telegram');
      if (!messageId || !adapter?.sendTextProgress) return false;
      if (text.length > adapter.maxTextLength) return false;

      try {
        const result = await adapter.sendTextProgress(input.peerId, text, {
          messageId,
        });
        if (typeof result?.messageId === 'number' && state) {
          state.messageId = result.messageId;
          state.text = text;
          state.pending = false;
        }
        return true;
      } catch (error) {
        this.deps.logger.warn(
          { error, sessionID: input.sessionID, messageId },
          'telegram final reply edit failed',
        );
        return false;
      }
    });
  }

  private async runSerialized<T>(
    sessionID: string,
    operation: () => Promise<T>,
  ): Promise<T> {
    const previous = this.sessionLocks.get(sessionID) ?? Promise.resolve();
    let release: () => void = () => undefined;
    const lock = new Promise<void>((resolve) => {
      release = () => resolve();
    });
    this.sessionLocks.set(sessionID, lock);

    await previous.catch(() => undefined);
    try {
      return await operation();
    } finally {
      release();
      if (this.sessionLocks.get(sessionID) === lock) {
        this.sessionLocks.delete(sessionID);
      }
    }
  }

  private async flush(sessionID: string, force = false): Promise<void> {
    await this.runSerialized(sessionID, () => this.flushNow(sessionID, force));
  }

  private async flushNow(sessionID: string, force = false): Promise<void> {
    const state = this.deps.stateStore.get(sessionID);
    if (!state || state.disabled) return;
    if (force) this.clearTimer(sessionID);
    if (!state.pending) return;

    const run = this.deps.resolveRun(sessionID, { includeSuppressed: true });
    if (!run) return;

    if (run.telegram.streamingSuppressed) {
      state.pending = false;
      return;
    }

    const adapter = this.deps.adapters.get('telegram');
    if (!adapter) return;
    const supportsProgress =
      adapter.capabilities.progress || Boolean(adapter.sendTextProgress);
    if (!supportsProgress || !adapter.sendTextProgress) return;

    const nextText = state.text.trim();
    if (!nextText) {
      state.pending = false;
      return;
    }
    if (nextText.length > adapter.maxTextLength) {
      state.disabled = true;
      this.deps.logger.debug(
        { sessionID, length: nextText.length, limit: adapter.maxTextLength },
        'telegram stream disabled (message too long)',
      );
      return;
    }

    state.pending = false;
    try {
      const result = await adapter.sendTextProgress(run.peerId, nextText, {
        ...(state.messageId ? { messageId: state.messageId } : {}),
      });
      if (typeof result?.messageId === 'number') {
        state.messageId = result.messageId;
      }
    } catch (error) {
      this.deps.logger.warn({ error, sessionID }, 'telegram stream flush failed');
    }
  }

  private clearTimer(sessionID: string): void {
    const state = this.deps.stateStore.get(sessionID);
    if (!state?.timer) return;
    this.scheduler.clearTimeout(state.timer);
    state.timer = null;
  }

  private scheduleFlush(sessionID: string): void {
    const state = this.deps.stateStore.get(sessionID);
    if (!state || state.disabled || state.timer) return;
    state.timer = this.scheduler.setTimeout(() => {
      state.timer = null;
      void this.flush(sessionID);
    }, this.deps.flushMs);
  }
}
