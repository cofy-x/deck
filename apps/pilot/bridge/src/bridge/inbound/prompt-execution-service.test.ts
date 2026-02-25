/**
 * @license
 * Copyright 2026 cofy-x
 * SPDX-License-Identifier: Apache-2.0
 */

import pino from 'pino';
import { describe, expect, test, vi } from 'vitest';

import type { BridgeStore } from '../../db.js';
import type { OpencodeClient } from '../../opencode.js';
import type { InboundMessage, PromptResponse } from '../../types/index.js';
import { PromptExecutionService } from './prompt-execution-service.js';

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

describe('PromptExecutionService', () => {
  test('returns prompt result without recovery when first call succeeds', async () => {
    const prompt = vi.fn(async () => ({
      data: createPromptResponse('ok'),
    }));
    const client = {
      session: { prompt },
    } as unknown as OpencodeClient;
    const store = {
      deleteSession: vi.fn(),
    } as unknown as BridgeStore;
    const createSession = vi.fn(async () => 'ses_new');

    const service = new PromptExecutionService({
      client,
      store,
      logger: pino({ enabled: false }),
      createSession,
    });

    const result = await service.promptWithSessionRecovery({
      message: createMessage(),
      peerKey: '7350281763',
      sessionID: 'ses_old',
    });

    expect(result.sessionID).toBe('ses_old');
    expect(prompt).toHaveBeenCalledTimes(1);
    expect(createSession).toHaveBeenCalledTimes(0);
  });

  test('recovers stale session and retries prompt once', async () => {
    const notFoundError = Object.assign(
      new Error('resource not found /storage/session/ses_old'),
      {
        status: 404,
      },
    );

    const prompt = vi
      .fn()
      .mockRejectedValueOnce(notFoundError)
      .mockResolvedValueOnce({
        data: createPromptResponse('recovered'),
      });
    const deleteSession = vi.fn();
    const client = {
      session: { prompt },
    } as unknown as OpencodeClient;
    const store = {
      deleteSession,
    } as unknown as BridgeStore;
    const createSession = vi.fn(async () => 'ses_new');
    const onSessionRecovered = vi.fn();

    const service = new PromptExecutionService({
      client,
      store,
      logger: pino({ enabled: false }),
      createSession,
    });

    const result = await service.promptWithSessionRecovery({
      message: createMessage(),
      peerKey: '7350281763',
      sessionID: 'ses_old',
      onSessionRecovered,
    });

    expect(deleteSession).toHaveBeenCalledWith('telegram', '7350281763');
    expect(createSession).toHaveBeenCalledTimes(1);
    expect(prompt).toHaveBeenCalledTimes(2);
    expect(result.sessionID).toBe('ses_new');
    expect(onSessionRecovered).toHaveBeenCalledWith({
      previousSessionID: 'ses_old',
      nextSessionID: 'ses_new',
    });
  });
});
