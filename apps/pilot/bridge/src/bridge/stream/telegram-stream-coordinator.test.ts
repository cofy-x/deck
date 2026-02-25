/**
 * @license
 * Copyright 2025 cofy-x
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, expect, test, vi } from 'vitest';

import type {
  Adapter,
  ChannelName,
} from '../../types/index.js';
import { createTelegramStreamCoordinator } from './telegram-stream-coordinator.js';
import {
  createAssistantMessageInfo,
  createSilentLogger,
  createTelegramRunState,
  createUserMessageInfo,
} from './test-fixtures.js';
import type { Scheduler } from './telegram/flush-engine.js';

function createAdapterStub(
  sendTextProgress: NonNullable<Adapter['sendTextProgress']>,
): Adapter {
  return {
    name: 'telegram',
    maxTextLength: 4096,
    capabilities: {
      progress: true,
      typing: true,
      file: false,
    },
    start: async () => undefined,
    stop: async () => undefined,
    sendText: async () => undefined,
    sendTextProgress,
  };
}

describe('telegram stream coordinator', () => {
  test('streams assistant text only (user text never appears in stream)', async () => {
    const run = createTelegramRunState();
    const activeRuns = new Map([[run.sessionID, run]]);
    const sendTextProgress = vi.fn<
      NonNullable<Adapter['sendTextProgress']>
    >(async (_peerId, _text, options) => ({
      messageId: options?.messageId ?? 101,
    }));
    const adapters = new Map<ChannelName, Adapter>([
      ['telegram', createAdapterStub(sendTextProgress)],
    ]);
    const coordinator = createTelegramStreamCoordinator({
      logger: createSilentLogger(),
      activeRuns,
      adapters,
      flushMs: 5,
    });

    coordinator.onMessageUpdated(createUserMessageInfo(run.sessionID, 'msg_user'));
    await coordinator.onMessagePartUpdated({
      part: {
        sessionID: run.sessionID,
        messageID: 'msg_user',
        id: 'part_user',
        type: 'text',
        text: '说一个笑话',
      },
    });
    await coordinator.onSessionIdle(run.sessionID);
    expect(sendTextProgress).toHaveBeenCalledTimes(0);

    coordinator.onMessageUpdated(
      createAssistantMessageInfo(run.sessionID, 'msg_assistant'),
    );
    await coordinator.onMessagePartUpdated({
      part: {
        sessionID: run.sessionID,
        messageID: 'msg_assistant',
        id: 'part_assistant',
        type: 'text',
        text: '这是一个笑话。',
      },
    });
    await coordinator.onSessionIdle(run.sessionID);

    expect(sendTextProgress).toHaveBeenCalledTimes(1);
    expect(sendTextProgress.mock.calls[0]?.[1]).toBe('这是一个笑话。');
  });

  test('drops unknown role parts until message role is known', async () => {
    const run = createTelegramRunState();
    const activeRuns = new Map([[run.sessionID, run]]);
    const sendTextProgress = vi.fn<
      NonNullable<Adapter['sendTextProgress']>
    >(async (_peerId, _text, options) => ({
      messageId: options?.messageId ?? 202,
    }));
    const adapters = new Map<ChannelName, Adapter>([
      ['telegram', createAdapterStub(sendTextProgress)],
    ]);
    const coordinator = createTelegramStreamCoordinator({
      logger: createSilentLogger(),
      activeRuns,
      adapters,
      flushMs: 5,
    });

    await coordinator.onMessagePartUpdated({
      part: {
        sessionID: run.sessionID,
        messageID: 'msg_pending',
        id: 'part_pending',
        type: 'text',
        text: 'pending',
      },
    });
    await coordinator.onSessionIdle(run.sessionID);
    expect(sendTextProgress).toHaveBeenCalledTimes(0);

    coordinator.onMessageUpdated(
      createAssistantMessageInfo(run.sessionID, 'msg_pending'),
    );
    await coordinator.onMessagePartUpdated({
      part: {
        sessionID: run.sessionID,
        messageID: 'msg_pending',
        id: 'part_pending',
        type: 'text',
        text: '',
      },
      delta: 'ready',
    });
    await coordinator.onSessionIdle(run.sessionID);

    expect(sendTextProgress).toHaveBeenCalledTimes(1);
    expect(sendTextProgress.mock.calls[0]?.[1]).toBe('ready');
  });

  test('buffers delta before part classification and replays when text part arrives', async () => {
    const run = createTelegramRunState();
    const activeRuns = new Map([[run.sessionID, run]]);
    const sendTextProgress = vi.fn<
      NonNullable<Adapter['sendTextProgress']>
    >(async (_peerId, _text, options) => ({
      messageId: options?.messageId ?? 212,
    }));
    const adapters = new Map<ChannelName, Adapter>([
      ['telegram', createAdapterStub(sendTextProgress)],
    ]);
    const coordinator = createTelegramStreamCoordinator({
      logger: createSilentLogger(),
      activeRuns,
      adapters,
      flushMs: 5,
    });

    coordinator.onMessageUpdated(
      createAssistantMessageInfo(run.sessionID, 'msg_assistant'),
    );
    await coordinator.onMessagePartDelta({
      sessionID: run.sessionID,
      messageID: 'msg_assistant',
      partID: 'part_text',
      field: 'text',
      delta: 'hello ',
    });
    await coordinator.onMessagePartDelta({
      sessionID: run.sessionID,
      messageID: 'msg_assistant',
      partID: 'part_text',
      field: 'text',
      delta: 'world',
    });
    await coordinator.onSessionIdle(run.sessionID);
    expect(sendTextProgress).toHaveBeenCalledTimes(0);

    await coordinator.onMessagePartUpdated({
      part: {
        sessionID: run.sessionID,
        messageID: 'msg_assistant',
        id: 'part_text',
        type: 'text',
        text: '',
      },
    });
    await coordinator.onSessionIdle(run.sessionID);

    expect(sendTextProgress).toHaveBeenCalledTimes(1);
    expect(sendTextProgress.mock.calls[0]?.[1]).toBe('hello world');
  });

  test('drops reasoning deltas after classification and never streams them', async () => {
    const run = createTelegramRunState();
    const activeRuns = new Map([[run.sessionID, run]]);
    const sendTextProgress = vi.fn<
      NonNullable<Adapter['sendTextProgress']>
    >(async (_peerId, _text, options) => ({
      messageId: options?.messageId ?? 222,
    }));
    const adapters = new Map<ChannelName, Adapter>([
      ['telegram', createAdapterStub(sendTextProgress)],
    ]);
    const coordinator = createTelegramStreamCoordinator({
      logger: createSilentLogger(),
      activeRuns,
      adapters,
      flushMs: 5,
    });

    coordinator.onMessageUpdated(
      createAssistantMessageInfo(run.sessionID, 'msg_assistant'),
    );
    await coordinator.onMessagePartDelta({
      sessionID: run.sessionID,
      messageID: 'msg_assistant',
      partID: 'part_reasoning',
      field: 'text',
      delta: 'internal thinking...',
    });

    await coordinator.onMessagePartUpdated({
      part: {
        sessionID: run.sessionID,
        messageID: 'msg_assistant',
        id: 'part_reasoning',
        type: 'reasoning',
        text: 'internal thinking...',
        time: { start: Date.now() },
      },
    });
    await coordinator.onSessionIdle(run.sessionID);

    expect(sendTextProgress).toHaveBeenCalledTimes(0);
  });

  test('prevents regression when later snapshot is a shorter prefix', async () => {
    const run = createTelegramRunState();
    const activeRuns = new Map([[run.sessionID, run]]);
    const sendTextProgress = vi.fn<
      NonNullable<Adapter['sendTextProgress']>
    >(async (_peerId, _text, options) => ({
      messageId: options?.messageId ?? 232,
    }));
    const adapters = new Map<ChannelName, Adapter>([
      ['telegram', createAdapterStub(sendTextProgress)],
    ]);
    const coordinator = createTelegramStreamCoordinator({
      logger: createSilentLogger(),
      activeRuns,
      adapters,
      flushMs: 5,
    });

    coordinator.onMessageUpdated(
      createAssistantMessageInfo(run.sessionID, 'msg_assistant'),
    );
    await coordinator.onMessagePartUpdated({
      part: {
        sessionID: run.sessionID,
        messageID: 'msg_assistant',
        id: 'part_text',
        type: 'text',
        text: 'hello world',
      },
    });
    await coordinator.onSessionIdle(run.sessionID);

    await coordinator.onMessagePartUpdated({
      part: {
        sessionID: run.sessionID,
        messageID: 'msg_assistant',
        id: 'part_text',
        type: 'text',
        text: 'hello',
      },
    });
    await coordinator.onSessionIdle(run.sessionID);

    expect(sendTextProgress.mock.calls.length).toBeGreaterThanOrEqual(2);
    const lastCall = sendTextProgress.mock.calls.at(-1);
    expect(lastCall?.[1]).toBe('hello world');
  });

  test('finalize edits the same streamed message instead of creating another one', async () => {
    const run = createTelegramRunState();
    const activeRuns = new Map([[run.sessionID, run]]);
    const sendTextProgress = vi.fn<
      NonNullable<Adapter['sendTextProgress']>
    >(async (_peerId, _text, options) => ({
      messageId: options?.messageId ?? 303,
    }));
    const adapters = new Map<ChannelName, Adapter>([
      ['telegram', createAdapterStub(sendTextProgress)],
    ]);
    const coordinator = createTelegramStreamCoordinator({
      logger: createSilentLogger(),
      activeRuns,
      adapters,
      flushMs: 5,
    });

    coordinator.onMessageUpdated(
      createAssistantMessageInfo(run.sessionID, 'msg_assistant'),
    );
    await coordinator.onMessagePartUpdated({
      part: {
        sessionID: run.sessionID,
        messageID: 'msg_assistant',
        id: 'part_assistant',
        type: 'text',
        text: '',
      },
      delta: 'initial',
    });
    await coordinator.onSessionIdle(run.sessionID);

    const finalized = await coordinator.finalizeReply({
      sessionID: run.sessionID,
      peerId: run.peerId,
      text: 'final reply',
    });

    expect(finalized).toBe(true);
    expect(sendTextProgress.mock.calls.length).toBeGreaterThanOrEqual(2);
    const lastCall = sendTextProgress.mock.calls.at(-1);
    expect(lastCall?.[1]).toBe('final reply');
    expect(lastCall?.[2]).toEqual({ messageId: 303 });
  });

  test('returns false when final edit fails while preserving streamed message identity', async () => {
    const run = createTelegramRunState();
    const activeRuns = new Map([[run.sessionID, run]]);
    const sendTextProgress = vi.fn<
      NonNullable<Adapter['sendTextProgress']>
    >(async (_peerId, _text, options) => {
      if (options?.messageId) {
        throw new Error('edit failed');
      }
      return { messageId: 404 };
    });
    const adapters = new Map<ChannelName, Adapter>([
      ['telegram', createAdapterStub(sendTextProgress)],
    ]);
    const coordinator = createTelegramStreamCoordinator({
      logger: createSilentLogger(),
      activeRuns,
      adapters,
      flushMs: 5,
    });

    coordinator.onMessageUpdated(
      createAssistantMessageInfo(run.sessionID, 'msg_assistant'),
    );
    await coordinator.onMessagePartUpdated({
      part: {
        sessionID: run.sessionID,
        messageID: 'msg_assistant',
        id: 'part_assistant',
        type: 'text',
        text: 'initial',
      },
    });
    await coordinator.onSessionIdle(run.sessionID);

    const finalized = await coordinator.finalizeReply({
      sessionID: run.sessionID,
      peerId: run.peerId,
      text: 'final',
    });

    expect(finalized).toBe(false);
    expect(coordinator.hasStreamedMessage(run.sessionID)).toBe(true);
  });

  test('returns false when no streamed telegram message exists', async () => {
    const run = createTelegramRunState();
    const activeRuns = new Map([[run.sessionID, run]]);
    const sendTextProgress = vi.fn<
      NonNullable<Adapter['sendTextProgress']>
    >(async (_peerId, _text, options) => ({
      messageId: options?.messageId ?? 505,
    }));
    const adapters = new Map<ChannelName, Adapter>([
      ['telegram', createAdapterStub(sendTextProgress)],
    ]);
    const coordinator = createTelegramStreamCoordinator({
      logger: createSilentLogger(),
      activeRuns,
      adapters,
      flushMs: 5,
    });

    const finalized = await coordinator.finalizeReply({
      sessionID: run.sessionID,
      peerId: run.peerId,
      text: 'hello',
    });

    expect(finalized).toBe(false);
    expect(sendTextProgress).toHaveBeenCalledTimes(0);
    expect(coordinator.hasStreamedMessage(run.sessionID)).toBe(false);
  });

  test('does not flush pending text after streaming is suppressed', async () => {
    const run = createTelegramRunState();
    const activeRuns = new Map([[run.sessionID, run]]);
    const sendTextProgress = vi.fn<
      NonNullable<Adapter['sendTextProgress']>
    >(async (_peerId, _text, options) => ({
      messageId: options?.messageId ?? 566,
    }));
    const adapters = new Map<ChannelName, Adapter>([
      ['telegram', createAdapterStub(sendTextProgress)],
    ]);
    const coordinator = createTelegramStreamCoordinator({
      logger: createSilentLogger(),
      activeRuns,
      adapters,
      flushMs: 50,
    });

    coordinator.onMessageUpdated(
      createAssistantMessageInfo(run.sessionID, 'msg_assistant'),
    );
    await coordinator.onMessagePartUpdated({
      part: {
        sessionID: run.sessionID,
        messageID: 'msg_assistant',
        id: 'part_assistant',
        type: 'text',
        text: '',
      },
      delta: 'buffered',
    });

    run.telegram.streamingSuppressed = true;
    await coordinator.onSessionIdle(run.sessionID);

    expect(sendTextProgress).toHaveBeenCalledTimes(0);
  });

  test('does not create or edit stream messages when callbacks arrive while suppressed', async () => {
    const run = createTelegramRunState();
    run.telegram.streamingSuppressed = true;
    const activeRuns = new Map([[run.sessionID, run]]);
    const sendTextProgress = vi.fn<
      NonNullable<Adapter['sendTextProgress']>
    >(async (_peerId, _text, options) => ({
      messageId: options?.messageId ?? 577,
    }));
    const adapters = new Map<ChannelName, Adapter>([
      ['telegram', createAdapterStub(sendTextProgress)],
    ]);
    const coordinator = createTelegramStreamCoordinator({
      logger: createSilentLogger(),
      activeRuns,
      adapters,
      flushMs: 5,
    });

    coordinator.onMessageUpdated(
      createAssistantMessageInfo(run.sessionID, 'msg_assistant'),
    );
    await coordinator.onMessagePartUpdated({
      part: {
        sessionID: run.sessionID,
        messageID: 'msg_assistant',
        id: 'part_assistant',
        type: 'text',
        text: 'should-not-stream',
      },
      delta: 'delta',
    });
    await coordinator.onMessagePartDelta({
      sessionID: run.sessionID,
      messageID: 'msg_assistant',
      partID: 'part_assistant',
      field: 'text',
      delta: 'ignored',
    });
    await coordinator.onSessionIdle(run.sessionID);

    const finalized = await coordinator.finalizeReply({
      sessionID: run.sessionID,
      peerId: run.peerId,
      text: 'final reply',
    });

    expect(sendTextProgress).toHaveBeenCalledTimes(0);
    expect(finalized).toBe(false);
    expect(coordinator.hasStreamedMessage(run.sessionID)).toBe(false);
  });

  test('serializes idle flush and finalize to avoid duplicate new messages', async () => {
    const run = createTelegramRunState();
    const activeRuns = new Map([[run.sessionID, run]]);
    let newMessageSends = 0;
    const sendTextProgress = vi.fn<
      NonNullable<Adapter['sendTextProgress']>
    >(async (_peerId, _text, options) => {
      if (!options?.messageId) {
        newMessageSends += 1;
        await new Promise((resolve) => setTimeout(resolve, 5));
      }
      return { messageId: options?.messageId ?? 606 };
    });
    const adapters = new Map<ChannelName, Adapter>([
      ['telegram', createAdapterStub(sendTextProgress)],
    ]);
    const coordinator = createTelegramStreamCoordinator({
      logger: createSilentLogger(),
      activeRuns,
      adapters,
      flushMs: 1,
    });

    coordinator.onMessageUpdated(
      createAssistantMessageInfo(run.sessionID, 'msg_assistant'),
    );
    await coordinator.onMessagePartUpdated({
      part: {
        sessionID: run.sessionID,
        messageID: 'msg_assistant',
        id: 'part_assistant',
        type: 'text',
        text: '',
      },
      delta: 'hello',
    });

    await Promise.all([
      coordinator.onSessionIdle(run.sessionID),
      coordinator.finalizeReply({
        sessionID: run.sessionID,
        peerId: run.peerId,
        text: 'hello world',
      }),
    ]);

    expect(newMessageSends).toBe(1);
  });

  test('uses injected scheduler to control flush timing deterministically', async () => {
    const run = createTelegramRunState();
    const activeRuns = new Map([[run.sessionID, run]]);
    const sendTextProgress = vi.fn<
      NonNullable<Adapter['sendTextProgress']>
    >(async (_peerId, _text, options) => ({
      messageId: options?.messageId ?? 707,
    }));
    const adapters = new Map<ChannelName, Adapter>([
      ['telegram', createAdapterStub(sendTextProgress)],
    ]);

    const scheduled = new Set<() => void>();
    const scheduler: Scheduler = {
      setTimeout(callback, _delayMs) {
        scheduled.add(callback);
        return callback as unknown as ReturnType<typeof setTimeout>;
      },
      clearTimeout(timeout) {
        if (typeof timeout === 'function') {
          scheduled.delete(timeout as unknown as () => void);
        }
      },
    };

    const coordinator = createTelegramStreamCoordinator({
      logger: createSilentLogger(),
      activeRuns,
      adapters,
      flushMs: 999,
      scheduler,
    });

    coordinator.onMessageUpdated(
      createAssistantMessageInfo(run.sessionID, 'msg_assistant'),
    );
    await coordinator.onMessagePartUpdated({
      part: {
        sessionID: run.sessionID,
        messageID: 'msg_assistant',
        id: 'part_assistant',
        type: 'text',
        text: '',
      },
      delta: 'hello',
    });

    expect(sendTextProgress).toHaveBeenCalledTimes(0);
    expect(scheduled.size).toBe(1);

    const [flushCallback] = [...scheduled];
    flushCallback();
    await Promise.resolve();
    await Promise.resolve();

    expect(sendTextProgress).toHaveBeenCalledTimes(1);
  });
});
