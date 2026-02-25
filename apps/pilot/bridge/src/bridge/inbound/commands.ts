/**
 * @license
 * Copyright 2025 cofy-x
 * SPDX-License-Identifier: Apache-2.0
 */

import type { Logger } from 'pino';

import type { BridgeStore } from '../../db.js';
import type {
  ChannelName,
  Config,
  ModelRef,
  SendTextFn,
} from '../../types/index.js';
import { MODEL_PRESETS } from '../support/constants.js';
import type { ModelStore } from '../state/model-store.js';

// ---------------------------------------------------------------------------
// Dependencies
// ---------------------------------------------------------------------------

export interface CommandHandlerDeps {
  config: Config;
  store: BridgeStore;
  modelStore: ModelStore;
  logger: Logger;
  sendText: SendTextFn;
}

// ---------------------------------------------------------------------------
// Command handler
// ---------------------------------------------------------------------------

/**
 * Handle slash commands sent by users.
 * Returns `true` if the command was recognized and handled, `false` otherwise.
 */
export async function handleCommand(
  deps: CommandHandlerDeps,
  channel: ChannelName,
  peerKey: string,
  replyPeerId: string,
  text: string,
): Promise<boolean> {
  const { config, store, modelStore, logger, sendText } = deps;
  const parts = text.slice(1).split(/\s+/);
  const command = parts[0]?.toLowerCase();

  // Model switching via preset name (e.g. /opus, /codex)
  const presetModel: ModelRef | undefined = command
    ? MODEL_PRESETS[command]
    : undefined;
  if (presetModel) {
    modelStore.set(channel, peerKey, presetModel);
    await sendText(
      channel,
      replyPeerId,
      `Model switched to ${presetModel.providerID}/${presetModel.modelID}`,
      { kind: 'system' },
    );
    logger.info(
      { channel, peerId: peerKey, model: presetModel },
      'model switched via command',
    );
    return true;
  }

  // /model - show current model
  if (command === 'model') {
    const current = modelStore.get(channel, peerKey, config.model);
    const modelStr = current
      ? `${current.providerID}/${current.modelID}`
      : 'default';
    await sendText(channel, replyPeerId, `Current model: ${modelStr}`, {
      kind: 'system',
    });
    return true;
  }

  // /reset - clear model override and session
  if (command === 'reset') {
    modelStore.set(channel, peerKey, undefined);
    store.deleteSession(channel, peerKey);
    await sendText(
      channel,
      replyPeerId,
      'Session and model reset. Send a message to start fresh.',
      { kind: 'system' },
    );
    logger.info({ channel, peerId: peerKey }, 'session and model reset');
    return true;
  }

  // /help
  if (command === 'help') {
    const helpText = `/opus - Claude Opus 4.5\n/codex - GPT 5.2 Codex\n/model - show current\n/reset - start fresh\n/help - this`;
    await sendText(channel, replyPeerId, helpText, { kind: 'system' });
    return true;
  }

  // Unknown command - pass through as normal message
  return false;
}
