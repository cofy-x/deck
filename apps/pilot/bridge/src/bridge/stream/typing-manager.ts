/**
 * @license
 * Copyright 2025 cofy-x
 * SPDX-License-Identifier: Apache-2.0
 */

import type { Logger } from 'pino';

import type { Adapter, ChannelName, RunState } from '../../types/index.js';
import { TYPING_INTERVAL_MS } from '../support/constants.js';

/**
 * Manages typing indicator loops for active sessions.
 * Each session gets a periodic timer that sends typing updates.
 */
export class TypingManager {
  private readonly loops = new Map<string, NodeJS.Timeout>();

  constructor(
    private readonly adapters: Map<ChannelName, Adapter>,
    private readonly logger: Logger,
  ) {}

  start(run: RunState): void {
    const adapter = this.adapters.get(run.channel);
    if (!adapter) return;
    const sendTyping = adapter.sendTyping;
    const supportsTyping = adapter.capabilities.typing || Boolean(sendTyping);
    if (!supportsTyping || !sendTyping) return;
    if (this.loops.has(run.sessionID)) return;

    const sendTypingLoop = async () => {
      try {
        await sendTyping(run.peerId);
      } catch (error) {
        this.logger.warn(
          { error, channel: run.channel },
          'typing update failed',
        );
      }
    };

    void sendTypingLoop();
    const timer = setInterval(sendTypingLoop, TYPING_INTERVAL_MS);
    this.loops.set(run.sessionID, timer);
  }

  stop(sessionID: string): void {
    const timer = this.loops.get(sessionID);
    if (!timer) return;
    clearInterval(timer);
    this.loops.delete(sessionID);
  }

  stopAll(): void {
    for (const timer of this.loops.values()) {
      clearInterval(timer);
    }
    this.loops.clear();
  }
}
