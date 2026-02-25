/**
 * @license
 * Copyright 2025 cofy-x
 * SPDX-License-Identifier: Apache-2.0
 */

import type { ChannelName, ModelRef } from '../../types/index.js';

/**
 * Manages per-user model overrides.
 * Keys are formatted as `channel:peerId`.
 */
export class ModelStore {
  private readonly overrides = new Map<string, ModelRef>();

  private buildKey(channel: ChannelName, peerId: string): string {
    return `${channel}:${peerId}`;
  }

  get(
    channel: ChannelName,
    peerId: string,
    fallback?: ModelRef,
  ): ModelRef | undefined {
    const key = this.buildKey(channel, peerId);
    return this.overrides.get(key) ?? fallback;
  }

  set(channel: ChannelName, peerId: string, model: ModelRef | undefined): void {
    const key = this.buildKey(channel, peerId);
    if (model) {
      this.overrides.set(key, model);
    } else {
      this.overrides.delete(key);
    }
  }
}
