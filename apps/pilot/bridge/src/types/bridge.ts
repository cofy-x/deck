/**
 * @license
 * Copyright 2025 cofy-x
 * SPDX-License-Identifier: Apache-2.0
 */

import type { BridgeStore } from '../db.js';
import type { OpencodeClient } from '../opencode.js';
import type { Adapter } from './adapter.js';
import type { ChannelName, ModelRef } from './config.js';
import type { BridgeEvent } from './events.js';
export type { RunState } from './run-state.js';

// ---------------------------------------------------------------------------
// Bridge dependencies (for testing / injection)
// ---------------------------------------------------------------------------

export interface BridgeDeps {
  client?: OpencodeClient;
  store?: BridgeStore;
  adapters?: Map<ChannelName, Adapter>;
  disableEventStream?: boolean;
  disableHealthServer?: boolean;
}

// ---------------------------------------------------------------------------
// Bridge instance returned by startBridge
// ---------------------------------------------------------------------------

export interface BridgeInstance {
  stop(): Promise<void>;
  dispatchInbound(message: {
    channel: ChannelName;
    peerId: string;
    text: string;
    raw?: object | null;
    fromMe?: boolean;
  }): Promise<void>;
}

// ---------------------------------------------------------------------------
// Bridge return type for adapter config handlers
// ---------------------------------------------------------------------------

export interface AdapterConfigResult {
  configured: boolean;
  enabled: boolean;
}

// ---------------------------------------------------------------------------
// OpenCode event subscription stream type
// ---------------------------------------------------------------------------

export interface EventSubscription {
  stream: AsyncIterable<BridgeEvent>;
}

// ---------------------------------------------------------------------------
// Session model tracking
// ---------------------------------------------------------------------------

export type SessionModelMap = Map<string, ModelRef>;
