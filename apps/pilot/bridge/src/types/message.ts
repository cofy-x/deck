/**
 * @license
 * Copyright 2025 cofy-x
 * SPDX-License-Identifier: Apache-2.0
 */

import type { ChannelName } from './config.js';

// ---------------------------------------------------------------------------
// Inbound / outbound message types
// ---------------------------------------------------------------------------

/** Generic inbound message from any channel adapter. */
export interface InboundMessage {
  channel: ChannelName;
  peerId: string;
  text: string;
  raw: object | null;
  fromMe?: boolean;
}

/** Generic message handler callback accepted by adapters. */
export type MessageHandler = (message: InboundMessage) => Promise<void> | void;

/** Classification of outbound messages. */
export type OutboundKind = 'reply' | 'system' | 'tool';

/** Options for the sendText helper used by the bridge. */
export interface SendTextOptions {
  kind?: OutboundKind;
  display?: boolean;
}

/** Signature of the bridge-level sendText function. */
export type SendTextFn = (
  channel: ChannelName,
  peerId: string,
  text: string,
  options?: SendTextOptions,
) => Promise<void>;

// ---------------------------------------------------------------------------
// Bridge reporter - status and message event callbacks
// ---------------------------------------------------------------------------

export interface BridgeReporter {
  onStatus?: (message: string) => void;
  onInbound?: (message: {
    channel: ChannelName;
    peerId: string;
    text: string;
    fromMe?: boolean;
  }) => void;
  onOutbound?: (message: {
    channel: ChannelName;
    peerId: string;
    text: string;
    kind: OutboundKind;
  }) => void;
}
