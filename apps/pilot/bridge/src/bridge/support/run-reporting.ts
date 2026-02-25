/**
 * @license
 * Copyright 2025 cofy-x
 * SPDX-License-Identifier: Apache-2.0
 */

import { normalizeWhatsAppId } from '../../config.js';
import type { ChannelName, ModelRef, RunState } from '../../types/index.js';
import { CHANNEL_LABELS } from './constants.js';

export function formatPeer(channel: ChannelName, peerId: string): string {
  return channel === 'whatsapp' ? normalizeWhatsAppId(peerId) : peerId;
}

export function formatModelLabel(model?: ModelRef): string | null {
  return model ? `${model.providerID}/${model.modelID}` : null;
}

export function reportThinking(
  run: RunState,
  sessionModels: Map<string, ModelRef>,
  reportStatus?: (message: string) => void,
): void {
  if (!reportStatus) return;
  const modelLabel = formatModelLabel(sessionModels.get(run.sessionID));
  const nextLabel = modelLabel ? `Thinking (${modelLabel})` : 'Thinking...';
  if (
    run.lifecycle.thinkingLabel === nextLabel &&
    run.lifecycle.thinkingActive
  ) {
    return;
  }
  run.lifecycle.thinkingLabel = nextLabel;
  run.lifecycle.thinkingActive = true;
  reportStatus(
    `[${CHANNEL_LABELS[run.channel]}] ${formatPeer(run.channel, run.peerId)} ${nextLabel}`,
  );
}

export function reportDone(
  run: RunState,
  sessionModels: Map<string, ModelRef>,
  reportStatus?: (message: string) => void,
): void {
  if (!reportStatus || !run.lifecycle.thinkingActive) return;
  const modelLabel = formatModelLabel(sessionModels.get(run.sessionID));
  const suffix = modelLabel ? ` (${modelLabel})` : '';
  reportStatus(
    `[${CHANNEL_LABELS[run.channel]}] ${formatPeer(run.channel, run.peerId)} Done${suffix}`,
  );
  run.lifecycle.thinkingActive = false;
}
