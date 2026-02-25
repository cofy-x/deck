/**
 * @license
 * Copyright 2026 cofy-x
 * SPDX-License-Identifier: Apache-2.0
 */

import type {
  ChannelName,
  GenericRunState,
  RunState,
  TelegramRunState,
} from '../../types/index.js';

export interface CreateRunStateInput {
  sessionID: string;
  channel: ChannelName;
  peerId: string;
  toolUpdatesEnabled: boolean;
}

export function createRunState(
  input: CreateRunStateInput & { channel: 'telegram' },
): TelegramRunState;
export function createRunState(
  input: CreateRunStateInput & { channel: Exclude<ChannelName, 'telegram'> },
): GenericRunState;
export function createRunState(input: CreateRunStateInput): RunState;
export function createRunState(input: CreateRunStateInput): RunState {
  const base = {
    sessionID: input.sessionID,
    peerId: input.peerId,
    toolUpdatesEnabled: input.toolUpdatesEnabled,
    seenToolStates: new Map<string, string>(),
    lifecycle: {
      thinkingActive: false,
    },
  };

  if (input.channel === 'telegram') {
    return {
      ...base,
      channel: 'telegram',
      telegram: {
        streamingSuppressed: false,
        thinkingNoticeSent: false,
        seenReasoningParts: new Set<string>(),
      },
    };
  }
  return {
    ...base,
    channel: input.channel,
  };
}

export function isTelegramRun(run: RunState): run is TelegramRunState {
  return run.channel === 'telegram';
}
