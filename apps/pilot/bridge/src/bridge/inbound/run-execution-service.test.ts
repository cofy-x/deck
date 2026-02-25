/**
 * @license
 * Copyright 2026 cofy-x
 * SPDX-License-Identifier: Apache-2.0
 */

import pino from 'pino';
import { describe, expect, test, vi } from 'vitest';

import type { Config, InboundMessage, PromptResponse } from '../../types/index.js';
import { ModelStore } from '../state/model-store.js';
import { RunExecutionService } from './run-execution-service.js';
import { createRunState } from '../state/run-state.js';
import type { SessionBindingService, SessionRunBinding } from './session-binding-service.js';
import { MapStreamCoordinatorRegistry } from '../stream/stream-coordinator.js';

function createMessage(): InboundMessage {
  return {
    channel: 'telegram',
    peerId: '7350281763',
    text: 'hello',
    raw: null,
  };
}

function createPromptResponse(text: string): PromptResponse {
  return {
    id: 'resp_1',
    sessionID: 'ses_new',
    messageID: 'msg_1',
    parts: [
      {
        type: 'text',
        text,
      },
    ],
    info: {},
  } as unknown as PromptResponse;
}

function createConfig(): Config {
  return {
    model: undefined,
  } as unknown as Config;
}

describe('RunExecutionService', () => {
  test('rebinds session on recovery and falls back to regular send when stream finalization misses', async () => {
    const runState = createRunState({
      sessionID: 'ses_old',
      channel: 'telegram',
      peerId: '7350281763',
      toolUpdatesEnabled: false,
    });
    let currentSessionID = 'ses_old';
    const binding: SessionRunBinding = {
      runState,
      get currentSessionID() {
        return currentSessionID;
      },
      initialize: vi.fn(),
      rebind: vi.fn((nextSessionID: string) => {
        currentSessionID = nextSessionID;
        runState.sessionID = nextSessionID;
      }),
      finalize: vi.fn(),
    } as unknown as SessionRunBinding;

    const createRunBinding = vi.fn(() => binding);
    const promptWithSessionRecovery = vi.fn(async (input: {
      onSessionRecovered?: (params: {
        previousSessionID: string;
        nextSessionID: string;
      }) => void;
    }) => {
      await input.onSessionRecovered?.({
        previousSessionID: 'ses_old',
        nextSessionID: 'ses_new',
      });
      return {
        sessionID: 'ses_new',
        response: createPromptResponse('recovered reply'),
      };
    });

    const finalizeReply = vi.fn(async () => false);
    const hasStreamedMessage = vi.fn(() => false);
    const sendText = vi.fn(async () => undefined);

    const service = new RunExecutionService({
      config: createConfig(),
      logger: pino({ enabled: false }),
      modelStore: new ModelStore(),
      promptExecutionService: {
        promptWithSessionRecovery,
      } as never,
      sessionBindingService: {
        createRunBinding,
      } as unknown as SessionBindingService,
      streamCoordinatorRegistry: new MapStreamCoordinatorRegistry(
        new Map([
          [
            'telegram',
            {
              onMessageUpdated: () => undefined,
              onMessagePartDelta: async () => undefined,
              onMessagePartUpdated: async () => undefined,
              onSessionIdle: async () => undefined,
              finalizeReply,
              hasStreamedMessage,
              clearSession: () => undefined,
            },
          ],
        ]),
      ),
      sendText,
    });

    await service.execute({
      message: createMessage(),
      peerKey: '7350281763',
      sessionID: 'ses_old',
    });

    expect(createRunBinding).toHaveBeenCalledWith({
      message: createMessage(),
      sessionID: 'ses_old',
    });
    expect(binding.rebind).toHaveBeenCalledWith('ses_new');
    expect(sendText).toHaveBeenCalledWith('telegram', '7350281763', 'recovered reply', {
      kind: 'reply',
    });
    expect(runState.telegram.streamingSuppressed).toBe(true);
    expect(binding.finalize).toHaveBeenCalledTimes(1);
  });

  test('skips fallback send when stream finalization fails after streamed message exists', async () => {
    const runState = createRunState({
      sessionID: 'ses_1',
      channel: 'telegram',
      peerId: '7350281763',
      toolUpdatesEnabled: false,
    });
    const binding: SessionRunBinding = {
      runState,
      get currentSessionID() {
        return runState.sessionID;
      },
      initialize: vi.fn(),
      rebind: vi.fn(),
      finalize: vi.fn(),
    } as unknown as SessionRunBinding;

    const finalizeReply = vi.fn(async () => false);
    const hasStreamedMessage = vi.fn(() => true);
    const sendText = vi.fn(async () => undefined);

    const service = new RunExecutionService({
      config: createConfig(),
      logger: pino({ enabled: false }),
      modelStore: new ModelStore(),
      promptExecutionService: {
        promptWithSessionRecovery: vi.fn(async () => ({
          sessionID: 'ses_1',
          response: createPromptResponse('already streamed'),
        })),
      } as never,
      sessionBindingService: {
        createRunBinding: vi.fn(() => binding),
      } as unknown as SessionBindingService,
      streamCoordinatorRegistry: new MapStreamCoordinatorRegistry(
        new Map([
          [
            'telegram',
            {
              onMessageUpdated: () => undefined,
              onMessagePartDelta: async () => undefined,
              onMessagePartUpdated: async () => undefined,
              onSessionIdle: async () => undefined,
              finalizeReply,
              hasStreamedMessage,
              clearSession: () => undefined,
            },
          ],
        ]),
      ),
      sendText,
    });

    await service.execute({
      message: createMessage(),
      peerKey: '7350281763',
      sessionID: 'ses_1',
    });

    expect(finalizeReply).toHaveBeenCalledTimes(1);
    expect(hasStreamedMessage).toHaveBeenCalledTimes(2);
    expect(sendText).not.toHaveBeenCalled();
    expect(runState.telegram.streamingSuppressed).toBe(false);
  });
});
