/**
 * @license
 * Copyright 2026 cofy-x
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, expect, test, vi } from 'vitest';

import type { Config, SendTextFn, TelegramRunState } from '../../types/index.js';
import { createRunState } from '../state/run-state.js';
import { TelegramChannelHooks } from './telegram-channel-hooks.js';

function createRun(sessionID = 'ses_telegram_1'): TelegramRunState {
  return createRunState({
    sessionID,
    channel: 'telegram',
    peerId: '7350281763',
    toolUpdatesEnabled: true,
  });
}

function createConfig(mode: Config['telegramThinkingMode']): Config {
  return {
    telegramThinkingMode: mode,
    toolOutputLimit: 1200,
  } as unknown as Config;
}

describe('TelegramChannelHooks', () => {
  test('does not send thinking notice when streaming is suppressed', async () => {
    const run = createRun();
    run.telegram.streamingSuppressed = true;
    const sendText = vi.fn<SendTextFn>(async () => undefined);
    const hooks = new TelegramChannelHooks();

    await hooks.onMessagePartUpdated({
      run,
      part: {
        id: 'part_reasoning',
        sessionID: run.sessionID,
        messageID: 'msg_1',
        type: 'reasoning',
        text: 'reasoning...',
        time: { start: Date.now() },
      },
      config: createConfig('summary'),
      sendText,
    });

    expect(sendText).not.toHaveBeenCalled();
    expect(run.telegram.thinkingNoticeSent).toBe(false);
  });

  test('does not send reasoning debug text when streaming is suppressed', async () => {
    const run = createRun();
    run.telegram.streamingSuppressed = true;
    const sendText = vi.fn<SendTextFn>(async () => undefined);
    const hooks = new TelegramChannelHooks();

    await hooks.onMessagePartUpdated({
      run,
      part: {
        id: 'part_reasoning',
        sessionID: run.sessionID,
        messageID: 'msg_1',
        type: 'reasoning',
        text: 'internal details',
        time: { start: Date.now(), end: Date.now() + 1 },
      },
      config: createConfig('raw_debug'),
      sendText,
    });

    expect(sendText).not.toHaveBeenCalled();
    expect(run.telegram.seenReasoningParts.size).toBe(0);
  });

  test('does not send done notice on session idle when streaming is suppressed', async () => {
    const run = createRun();
    run.telegram.streamingSuppressed = true;
    run.telegram.thinkingNoticeSent = true;
    const sendText = vi.fn<SendTextFn>(async () => undefined);
    const hooks = new TelegramChannelHooks();

    await hooks.onSessionIdle({
      run,
      config: createConfig('summary'),
      sendText,
    });

    expect(sendText).not.toHaveBeenCalled();
    expect(run.telegram.thinkingNoticeSent).toBe(false);
  });
});
