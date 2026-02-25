/**
 * @license
 * Copyright 2026 cofy-x
 * SPDX-License-Identifier: Apache-2.0
 */

import type { Logger } from 'pino';

import type { BridgeStore } from '../../db.js';
import type { OpencodeClient } from '../../opencode.js';
import type {
  InboundMessage,
  ModelRef,
  PromptResponse,
} from '../../types/index.js';
import {
  extractPromptResponseError,
  isSessionNotFoundError,
  normalizeOpencodeError,
} from './opencode-errors.js';

export interface SessionRecoveryInput {
  message: InboundMessage;
  peerKey: string;
  sessionID: string;
  model?: ModelRef;
  onSessionRecovered?: (input: {
    previousSessionID: string;
    nextSessionID: string;
  }) => void | Promise<void>;
}

export interface PromptExecutionServiceDeps {
  client: OpencodeClient;
  store: BridgeStore;
  logger: Logger;
  createSession: (
    message: InboundMessage,
    options?: { announce?: boolean; reason?: 'initial' | 'recovery' },
  ) => Promise<string>;
}

export class PromptExecutionService {
  constructor(private readonly deps: PromptExecutionServiceDeps) {}

  async promptWithSessionRecovery(
    input: SessionRecoveryInput,
  ): Promise<{ sessionID: string; response: PromptResponse }> {
    let activeSessionID = input.sessionID;

    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        const response = await this.deps.client.session.prompt<true>(
          {
            sessionID: activeSessionID,
            parts: [{ type: 'text', text: input.message.text }],
            ...(input.model ? { model: input.model } : {}),
          },
          { throwOnError: true },
        );

        const responseError = extractPromptResponseError(response.data);
        if (!responseError) {
          return { sessionID: activeSessionID, response: response.data };
        }

        if (attempt === 0 && isSessionNotFoundError(responseError, activeSessionID)) {
          this.deps.logger.warn(
            {
              channel: input.message.channel,
              peerId: input.message.peerId,
              sessionID: activeSessionID,
              message: responseError.message,
            },
            'stale session detected in prompt response, recreating',
          );
          this.deps.store.deleteSession(input.message.channel, input.peerKey);
          const recoveredSessionID = await this.deps.createSession(
            { ...input.message, peerId: input.peerKey },
            { announce: false, reason: 'recovery' },
          );
          if (input.onSessionRecovered) {
            await input.onSessionRecovered({
              previousSessionID: activeSessionID,
              nextSessionID: recoveredSessionID,
            });
          }
          activeSessionID = recoveredSessionID;
          continue;
        }

        throw responseError.raw;
      } catch (error) {
        const normalizedError = normalizeOpencodeError(error);
        if (
          attempt === 0 &&
          normalizedError &&
          isSessionNotFoundError(normalizedError, activeSessionID)
        ) {
          this.deps.logger.warn(
            {
              channel: input.message.channel,
              peerId: input.message.peerId,
              sessionID: activeSessionID,
              message: normalizedError.message,
            },
            'stale session detected from prompt failure, recreating',
          );
          this.deps.store.deleteSession(input.message.channel, input.peerKey);
          const recoveredSessionID = await this.deps.createSession(
            { ...input.message, peerId: input.peerKey },
            { announce: false, reason: 'recovery' },
          );
          if (input.onSessionRecovered) {
            await input.onSessionRecovered({
              previousSessionID: activeSessionID,
              nextSessionID: recoveredSessionID,
            });
          }
          activeSessionID = recoveredSessionID;
          continue;
        }
        throw error;
      }
    }

    throw new Error('OpenCode session recovery failed. Send /reset and retry.');
  }
}
