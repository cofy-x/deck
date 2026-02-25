/**
 * @license
 * Copyright 2026 cofy-x
 * SPDX-License-Identifier: Apache-2.0
 */

import type { ChannelName } from './config.js';

export type ToolStateTracker = Map<string, string>;
export type ReasoningPartTracker = Set<string>;

export interface RunLifecycleState {
  thinkingLabel?: string;
  thinkingActive: boolean;
}

export interface BaseRunState {
  sessionID: string;
  channel: ChannelName;
  peerId: string;
  toolUpdatesEnabled: boolean;
  seenToolStates: ToolStateTracker;
  lifecycle: RunLifecycleState;
}

export interface TelegramRunState extends BaseRunState {
  channel: 'telegram';
  telegram: {
    streamingSuppressed: boolean;
    thinkingNoticeSent: boolean;
    seenReasoningParts: ReasoningPartTracker;
  };
}

export interface GenericRunState extends BaseRunState {
  channel: Exclude<ChannelName, 'telegram'>;
}

export type RunState = TelegramRunState | GenericRunState;
