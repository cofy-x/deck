/**
 * @license
 * Copyright 2026 cofy-x
 * SPDX-License-Identifier: Apache-2.0
 */

import type { Config, TelegramThinkingMode } from '../../types/index.js';
import { truncateText } from '../../text.js';
import type {
  ChannelHooks,
  MessagePartUpdatedHookInput,
  SessionIdleHookInput,
} from './channel-hooks.js';
import { isTelegramRun } from '../state/run-state.js';

function getTelegramThinkingMode(config: Config): TelegramThinkingMode {
  return config.telegramThinkingMode ?? 'off';
}

export class TelegramChannelHooks implements ChannelHooks {
  async onMessagePartUpdated(input: MessagePartUpdatedHookInput): Promise<void> {
    const { run, part, config, sendText } = input;
    if (!isTelegramRun(run)) return;
    if (run.telegram.streamingSuppressed) return;
    if (part.type !== 'reasoning') return;

    const mode = getTelegramThinkingMode(config);
    if (mode === 'off') return;

    if (!run.telegram.thinkingNoticeSent) {
      run.telegram.thinkingNoticeSent = true;
      await sendText(run.channel, run.peerId, '🤔 Thinking...', {
        kind: 'system',
      });
    }

    if (mode !== 'raw_debug') return;
    if (!part.time.end) return;

    const text = part.text.trim();
    if (!text) return;
    if (run.telegram.seenReasoningParts.has(part.id)) return;
    run.telegram.seenReasoningParts.add(part.id);

    await sendText(
      run.channel,
      run.peerId,
      `[debug][thinking]\n${truncateText(text, config.toolOutputLimit)}`,
      { kind: 'system' },
    );
  }

  async onSessionIdle(input: SessionIdleHookInput): Promise<void> {
    const { run, config, sendText } = input;
    if (!isTelegramRun(run)) return;
    if (run.telegram.streamingSuppressed) {
      run.telegram.thinkingNoticeSent = false;
      return;
    }
    if (!run.telegram.thinkingNoticeSent) return;

    const mode = getTelegramThinkingMode(config);
    if (mode === 'off') return;

    run.telegram.thinkingNoticeSent = false;
    await sendText(run.channel, run.peerId, '✅ Done.', { kind: 'system' });
  }
}
