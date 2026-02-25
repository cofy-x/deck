/**
 * @license
 * Copyright 2025 cofy-x
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, expect, test, vi } from 'vitest';

import type {
  BridgeEvent,
  BridgeReporter,
  ChannelName,
  Config,
  ModelRef,
  RunState,
  SendTextFn,
} from '../../types/index.js';
import type {
  ChannelHooks,
  MessagePartUpdatedHookInput,
  SessionIdleHookInput,
} from './channel-hooks.js';
import { MapChannelHooksRegistry } from './channel-hooks.js';
import {
  MapStreamCoordinatorRegistry,
  type StreamCoordinator,
} from './stream-coordinator.js';
import {
  startEventStream,
  type EventStreamClient,
  type EventStreamTypingManager,
} from './event-stream.js';
import { TelegramChannelHooks } from './telegram-channel-hooks.js';
import {
  createBridgeTestConfig,
  createGenericRunState,
  createTelegramRunState,
} from './test-fixtures.js';

async function* streamFrom(events: BridgeEvent[]): AsyncGenerator<BridgeEvent> {
  for (const event of events) {
    yield event;
  }
}

function createClient(events: BridgeEvent[]) {
  const subscribe = vi.fn(async () => ({ stream: streamFrom(events) }));
  const respond = vi.fn(async () => undefined);
  const client: EventStreamClient = {
    event: { subscribe },
    permission: { respond },
  };
  return { client, subscribe, respond };
}

function createDeps(input: {
  events: BridgeEvent[];
  config?: Config;
  activeRuns?: Map<string, RunState>;
  sessionModels?: Map<string, ModelRef>;
  reporter?: BridgeReporter;
  streamCoordinators?: Map<ChannelName, StreamCoordinator>;
  channelHooks?: Map<ChannelName, ChannelHooks>;
}) {
  const { client, respond } = createClient(input.events);
  const typingStart = vi.fn();
  const typingStop = vi.fn();
  const onMessageUpdated = vi.fn();
  const onMessagePartDelta = vi.fn(async () => undefined);
  const onMessagePartUpdated = vi.fn(async () => undefined);
  const onSessionIdle = vi.fn(async () => undefined);
  const finalizeReply = vi.fn(async () => false);
  const clearSession = vi.fn();
  const hooksImpl = new TelegramChannelHooks();
  const onHookMessagePartUpdated = vi.fn(
    async (input: MessagePartUpdatedHookInput) =>
      hooksImpl.onMessagePartUpdated(input),
  );
  const onHookSessionIdle = vi.fn(
    async (input: SessionIdleHookInput) => hooksImpl.onSessionIdle(input),
  );
  const sendText = vi.fn<SendTextFn>(async () => undefined);
  const typingManager: EventStreamTypingManager = {
    start: typingStart,
    stop: typingStop,
  };
  const telegramStreamCoordinator: StreamCoordinator = {
    onMessageUpdated,
    onMessagePartDelta,
    onMessagePartUpdated,
    onSessionIdle,
    finalizeReply,
    clearSession,
    hasStreamedMessage: () => false,
  };
  const streamCoordinatorRegistry = new MapStreamCoordinatorRegistry(
    input.streamCoordinators ??
      new Map([['telegram', telegramStreamCoordinator]]),
  );
  const channelHooksRegistry = new MapChannelHooksRegistry(
    input.channelHooks ??
      new Map([
        [
          'telegram',
          {
            onMessagePartUpdated: onHookMessagePartUpdated,
            onSessionIdle: onHookSessionIdle,
          },
        ],
      ]),
  );

  return {
    deps: {
      client,
      config: input.config ?? createBridgeTestConfig(),
      activeRuns: input.activeRuns ?? new Map(),
      sessionModels: input.sessionModels ?? new Map(),
      typingManager,
      streamCoordinatorRegistry,
      channelHooksRegistry,
      reporter: input.reporter,
      sendText,
    },
    spies: {
      respond,
      typingStart,
      typingStop,
      onMessageUpdated,
      onMessagePartDelta,
      onMessagePartUpdated,
      onSessionIdle,
      onHookMessagePartUpdated,
      onHookSessionIdle,
      sendText,
    },
  };
}

describe('startEventStream', () => {
  test('handles message.updated and session.status with SDK Event union types', async () => {
    const run = createTelegramRunState();
    const activeRuns = new Map([[run.sessionID, run]]);
    const sessionModels = new Map<string, ModelRef>();
    const onStatus = vi.fn();
    const reporter: BridgeReporter = { onStatus };

    const messageUpdated: Extract<BridgeEvent, { type: 'message.updated' }> = {
      type: 'message.updated',
      properties: {
        info: {
          id: 'msg_1',
          sessionID: run.sessionID,
          role: 'user',
          time: { created: Date.now() },
          agent: 'assistant',
          model: { providerID: 'openai', modelID: 'gpt-5' },
        },
      },
    };
    const statusBusy: Extract<BridgeEvent, { type: 'session.status' }> = {
      type: 'session.status',
      properties: {
        sessionID: run.sessionID,
        status: { type: 'busy' },
      },
    };

    const { deps, spies } = createDeps({
      events: [messageUpdated, statusBusy],
      activeRuns,
      sessionModels,
      reporter,
    });

    await startEventStream(deps, new AbortController().signal);

    expect(spies.onMessageUpdated).toHaveBeenCalledTimes(1);
    expect(spies.typingStart).toHaveBeenCalledTimes(1);
    expect(sessionModels.get(run.sessionID)).toEqual({
      providerID: 'openai',
      modelID: 'gpt-5',
    });
    expect(onStatus).toHaveBeenCalled();
  });

  test('handles message.part.updated text and tool branches', async () => {
    const run = createTelegramRunState();
    const activeRuns = new Map([[run.sessionID, run]]);

    const textPart: Extract<BridgeEvent, { type: 'message.part.updated' }> = {
      type: 'message.part.updated',
      properties: {
        part: {
          id: 'part_text',
          sessionID: run.sessionID,
          messageID: 'msg_assistant',
          type: 'text',
          text: 'hello',
        },
      },
    };
    const toolPart: Extract<BridgeEvent, { type: 'message.part.updated' }> = {
      type: 'message.part.updated',
      properties: {
        part: {
          id: 'part_tool',
          sessionID: run.sessionID,
          messageID: 'msg_assistant',
          type: 'tool',
          callID: 'call_1',
          tool: 'custom_tool',
          state: {
            status: 'running',
            input: { cmd: 'ls -la' },
            title: 'running command',
            time: { start: Date.now() },
          },
        },
      },
    };
    // Same status should be deduped by seenToolStates.
    const toolPartDuplicate: Extract<BridgeEvent, { type: 'message.part.updated' }> = {
      type: 'message.part.updated',
      properties: {
        part: {
          id: 'part_tool',
          sessionID: run.sessionID,
          messageID: 'msg_assistant',
          type: 'tool',
          callID: 'call_1',
          tool: 'custom_tool',
          state: {
            status: 'running',
            input: { cmd: 'ls -la' },
            title: 'running command',
            time: { start: Date.now() },
          },
        },
      },
    };

    const { deps, spies } = createDeps({
      events: [textPart, toolPart, toolPartDuplicate],
      activeRuns,
    });

    await startEventStream(deps, new AbortController().signal);

    expect(spies.onMessagePartUpdated).toHaveBeenCalledTimes(3);
    expect(spies.sendText).toHaveBeenCalledTimes(1);
    expect(spies.sendText).toHaveBeenCalledWith(
      run.channel,
      run.peerId,
      expect.stringContaining('[tool] custom_tool running: running command'),
      { kind: 'tool' },
    );
  });

  test('forwards message.part.delta events to telegram coordinator', async () => {
    const run = createTelegramRunState();
    const activeRuns = new Map([[run.sessionID, run]]);

    const textDelta: Extract<BridgeEvent, { type: 'message.part.delta' }> = {
      type: 'message.part.delta',
      properties: {
        sessionID: run.sessionID,
        messageID: 'msg_assistant',
        partID: 'part_text',
        field: 'text',
        delta: 'stream-chunk',
      },
    };

    const ignoredDelta: Extract<BridgeEvent, { type: 'message.part.delta' }> = {
      type: 'message.part.delta',
      properties: {
        sessionID: run.sessionID,
        messageID: 'msg_assistant',
        partID: 'part_text',
        field: 'state.output',
        delta: 'ignored',
      },
    };

    const { deps, spies } = createDeps({
      events: [textDelta, ignoredDelta],
      activeRuns,
    });

    await startEventStream(deps, new AbortController().signal);

    expect(spies.onMessagePartDelta).toHaveBeenCalledTimes(2);
    expect(spies.onMessagePartDelta).toHaveBeenNthCalledWith(1, {
      sessionID: run.sessionID,
      messageID: 'msg_assistant',
      partID: 'part_text',
      field: 'text',
      delta: 'stream-chunk',
    });
    expect(spies.onMessagePartDelta).toHaveBeenNthCalledWith(2, {
      sessionID: run.sessionID,
      messageID: 'msg_assistant',
      partID: 'part_text',
      field: 'state.output',
      delta: 'ignored',
    });
  });

  test('handles session.status idle fallback', async () => {
    const run = createTelegramRunState();
    run.lifecycle.thinkingActive = true;
    const activeRuns = new Map([[run.sessionID, run]]);

    const idleStatus: Extract<BridgeEvent, { type: 'session.status' }> = {
      type: 'session.status',
      properties: {
        sessionID: run.sessionID,
        status: { type: 'idle' },
      },
    };

    const { deps, spies } = createDeps({
      events: [idleStatus],
      activeRuns,
    });

    await startEventStream(deps, new AbortController().signal);

    expect(spies.onSessionIdle).toHaveBeenCalledWith(run.sessionID);
    expect(spies.typingStop).toHaveBeenCalledWith(run.sessionID);
  });

  test('handles session.idle and permission.asked reject path', async () => {
    const run = createTelegramRunState();
    run.lifecycle.thinkingActive = true;
    const activeRuns = new Map([[run.sessionID, run]]);
    const config = createBridgeTestConfig('deny');

    const sessionIdle: Extract<BridgeEvent, { type: 'session.idle' }> = {
      type: 'session.idle',
      properties: {
        sessionID: run.sessionID,
      },
    };
    const permissionAsked: Extract<BridgeEvent, { type: 'permission.asked' }> = {
      type: 'permission.asked',
      properties: {
        id: 'perm_1',
        sessionID: run.sessionID,
        permission: 'tool.execute',
        patterns: ['*'],
        metadata: {},
        always: [],
      },
    };

    const { deps, spies } = createDeps({
      events: [sessionIdle, permissionAsked],
      activeRuns,
      config,
    });

    await startEventStream(deps, new AbortController().signal);

    expect(spies.onSessionIdle).toHaveBeenCalledWith(run.sessionID);
    expect(spies.typingStop).toHaveBeenCalledWith(run.sessionID);
    expect(spies.respond).toHaveBeenCalledWith({
      sessionID: run.sessionID,
      permissionID: 'perm_1',
      response: 'reject',
    });
    expect(spies.sendText).toHaveBeenCalledWith(
      run.channel,
      run.peerId,
      'Permission denied. Update configuration to allow tools.',
      { kind: 'system' },
    );
  });

  test('routes stream and hooks through a non-telegram coordinator', async () => {
    const run = createGenericRunState('discord', 'ses_discord_1');
    run.lifecycle.thinkingActive = true;
    const activeRuns = new Map([[run.sessionID, run]]);

    const onCustomUpdated = vi.fn(async () => undefined);
    const onCustomDelta = vi.fn(async () => undefined);
    const onCustomIdle = vi.fn(async () => undefined);
    const onCustomHookPart = vi.fn(async () => undefined);
    const onCustomHookIdle = vi.fn(async () => undefined);

    const customCoordinator: StreamCoordinator = {
      onMessageUpdated: () => undefined,
      onMessagePartUpdated: onCustomUpdated,
      onMessagePartDelta: onCustomDelta,
      onSessionIdle: onCustomIdle,
      finalizeReply: async () => false,
      hasStreamedMessage: () => false,
      clearSession: () => undefined,
    };
    const customHooks: ChannelHooks = {
      onMessagePartUpdated: onCustomHookPart,
      onSessionIdle: onCustomHookIdle,
    };

    const partUpdated: Extract<BridgeEvent, { type: 'message.part.updated' }> = {
      type: 'message.part.updated',
      properties: {
        part: {
          id: 'part_custom',
          sessionID: run.sessionID,
          messageID: 'msg_custom',
          type: 'text',
          text: 'custom stream',
        },
      },
    };
    const partDelta: Extract<BridgeEvent, { type: 'message.part.delta' }> = {
      type: 'message.part.delta',
      properties: {
        sessionID: run.sessionID,
        messageID: 'msg_custom',
        partID: 'part_custom',
        field: 'text',
        delta: 'delta',
      },
    };
    const idleStatus: Extract<BridgeEvent, { type: 'session.status' }> = {
      type: 'session.status',
      properties: {
        sessionID: run.sessionID,
        status: { type: 'idle' },
      },
    };

    const { deps, spies } = createDeps({
      events: [partUpdated, partDelta, idleStatus],
      activeRuns,
      streamCoordinators: new Map([['discord', customCoordinator]]),
      channelHooks: new Map([['discord', customHooks]]),
    });

    await startEventStream(deps, new AbortController().signal);

    expect(onCustomUpdated).toHaveBeenCalledTimes(1);
    expect(onCustomDelta).toHaveBeenCalledTimes(1);
    expect(onCustomIdle).toHaveBeenCalledWith(run.sessionID);
    expect(onCustomHookPart).toHaveBeenCalledTimes(1);
    expect(onCustomHookIdle).toHaveBeenCalledTimes(1);
    expect(spies.typingStop).toHaveBeenCalledWith(run.sessionID);
  });

  test('uses noop stream coordinator/default hooks for unregistered channel', async () => {
    const run = createGenericRunState('slack', 'ses_slack_1');
    run.lifecycle.thinkingActive = true;
    const activeRuns = new Map([[run.sessionID, run]]);

    const partUpdated: Extract<BridgeEvent, { type: 'message.part.updated' }> = {
      type: 'message.part.updated',
      properties: {
        part: {
          id: 'part_slack',
          sessionID: run.sessionID,
          messageID: 'msg_slack',
          type: 'text',
          text: 'noop stream',
        },
      },
    };
    const partDelta: Extract<BridgeEvent, { type: 'message.part.delta' }> = {
      type: 'message.part.delta',
      properties: {
        sessionID: run.sessionID,
        messageID: 'msg_slack',
        partID: 'part_slack',
        field: 'text',
        delta: 'noop',
      },
    };
    const idleStatus: Extract<BridgeEvent, { type: 'session.status' }> = {
      type: 'session.status',
      properties: {
        sessionID: run.sessionID,
        status: { type: 'idle' },
      },
    };

    const { deps, spies } = createDeps({
      events: [partUpdated, partDelta, idleStatus],
      activeRuns,
      streamCoordinators: new Map(),
      channelHooks: new Map(),
    });

    await expect(
      startEventStream(deps, new AbortController().signal),
    ).resolves.toBeUndefined();
    expect(spies.typingStop).toHaveBeenCalledWith(run.sessionID);
  });

  test('summary mode sends thinking and done notices for telegram reasoning parts', async () => {
    const run = createTelegramRunState();
    const activeRuns = new Map([[run.sessionID, run]]);
    const config = createBridgeTestConfig('allow', 'summary');

    const reasoningPart: Extract<BridgeEvent, { type: 'message.part.updated' }> = {
      type: 'message.part.updated',
      properties: {
        part: {
          id: 'part_reasoning',
          sessionID: run.sessionID,
          messageID: 'msg_assistant',
          type: 'reasoning',
          text: 'thinking',
          time: { start: Date.now() },
        },
      },
    };
    const idleStatus: Extract<BridgeEvent, { type: 'session.status' }> = {
      type: 'session.status',
      properties: {
        sessionID: run.sessionID,
        status: { type: 'idle' },
      },
    };

    const { deps, spies } = createDeps({
      events: [reasoningPart, idleStatus],
      activeRuns,
      config,
    });

    await startEventStream(deps, new AbortController().signal);

    expect(spies.sendText).toHaveBeenCalledWith(
      run.channel,
      run.peerId,
      '🤔 Thinking...',
      { kind: 'system' },
    );
    expect(spies.sendText).toHaveBeenCalledWith(
      run.channel,
      run.peerId,
      '✅ Done.',
      { kind: 'system' },
    );
  });

  test('raw_debug mode sends finalized reasoning text once', async () => {
    const run = createTelegramRunState();
    const activeRuns = new Map([[run.sessionID, run]]);
    const config = createBridgeTestConfig('allow', 'raw_debug');

    const reasoningPart: Extract<BridgeEvent, { type: 'message.part.updated' }> = {
      type: 'message.part.updated',
      properties: {
        part: {
          id: 'part_reasoning',
          sessionID: run.sessionID,
          messageID: 'msg_assistant',
          type: 'reasoning',
          text: 'final reasoning details',
          time: { start: Date.now(), end: Date.now() + 1 },
        },
      },
    };

    const { deps, spies } = createDeps({
      events: [reasoningPart],
      activeRuns,
      config,
    });

    await startEventStream(deps, new AbortController().signal);

    expect(spies.sendText).toHaveBeenCalledWith(
      run.channel,
      run.peerId,
      '[debug][thinking]\nfinal reasoning details',
      { kind: 'system' },
    );
  });

  test('dispatches telegram stream coordinator updates even when streaming is suppressed', async () => {
    const run = createTelegramRunState();
    run.telegram.streamingSuppressed = true;
    const activeRuns = new Map([[run.sessionID, run]]);

    const messageUpdated: Extract<BridgeEvent, { type: 'message.updated' }> = {
      type: 'message.updated',
      properties: {
        info: {
          id: 'msg_1',
          sessionID: run.sessionID,
          role: 'assistant',
          time: { created: Date.now() },
          parentID: 'msg_parent',
          modelID: 'gpt-5',
          providerID: 'openai',
          mode: 'chat',
          agent: 'assistant',
          path: { cwd: '/tmp', root: '/tmp' },
          cost: 0,
          tokens: {
            input: 0,
            output: 0,
            reasoning: 0,
            cache: { read: 0, write: 0 },
          },
        },
      },
    };
    const textPart: Extract<BridgeEvent, { type: 'message.part.updated' }> = {
      type: 'message.part.updated',
      properties: {
        part: {
          id: 'part_text',
          sessionID: run.sessionID,
          messageID: 'msg_1',
          type: 'text',
          text: 'hello',
        },
      },
    };
    const delta: Extract<BridgeEvent, { type: 'message.part.delta' }> = {
      type: 'message.part.delta',
      properties: {
        sessionID: run.sessionID,
        messageID: 'msg_1',
        partID: 'part_text',
        field: 'text',
        delta: ' world',
      },
    };

    const { deps, spies } = createDeps({
      events: [messageUpdated, textPart, delta],
      activeRuns,
    });

    await startEventStream(deps, new AbortController().signal);

    expect(spies.onMessageUpdated).toHaveBeenCalledTimes(1);
    expect(spies.onMessagePartUpdated).toHaveBeenCalledTimes(1);
    expect(spies.onMessagePartDelta).toHaveBeenCalledTimes(1);
    expect(spies.onHookMessagePartUpdated).toHaveBeenCalledTimes(1);
  });

  test('dispatches telegram idle handlers when streaming is suppressed', async () => {
    const run = createTelegramRunState();
    run.telegram.streamingSuppressed = true;
    const activeRuns = new Map([[run.sessionID, run]]);

    const statusIdle: Extract<BridgeEvent, { type: 'session.status' }> = {
      type: 'session.status',
      properties: {
        sessionID: run.sessionID,
        status: { type: 'idle' },
      },
    };
    const sessionIdle: Extract<BridgeEvent, { type: 'session.idle' }> = {
      type: 'session.idle',
      properties: {
        sessionID: run.sessionID,
      },
    };

    const { deps, spies } = createDeps({
      events: [statusIdle, sessionIdle],
      activeRuns,
    });

    await startEventStream(deps, new AbortController().signal);

    expect(spies.onSessionIdle).toHaveBeenCalledTimes(2);
    expect(spies.onHookSessionIdle).toHaveBeenCalledTimes(2);
    expect(spies.typingStop).toHaveBeenCalledTimes(2);
  });
});
