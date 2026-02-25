/**
 * @license
 * Copyright 2026 cofy-x
 * SPDX-License-Identifier: Apache-2.0
 */

import type { Logger } from 'pino';

import type {
  Config,
  InboundMessage,
  PromptResponsePart,
  RunState,
  SendTextFn,
} from '../../types/index.js';
import type { ModelStore } from '../state/model-store.js';
import {
  buildOpencodeErrorMessage,
  extractPromptResponseError,
  normalizeOpencodeError,
} from './opencode-errors.js';
import type { PromptExecutionService } from './prompt-execution-service.js';
import { isTelegramRun } from '../state/run-state.js';
import type { SessionBindingService } from './session-binding-service.js';
import type { StreamCoordinatorRegistry } from '../stream/stream-coordinator.js';

type PromptTextPart = Extract<PromptResponsePart, { type: 'text' }>;

function isPromptTextPart(part: PromptResponsePart): part is PromptTextPart {
  return part.type === 'text' && !part.ignored;
}

export interface RunExecutionServiceDeps {
  config: Config;
  logger: Logger;
  modelStore: ModelStore;
  promptExecutionService: PromptExecutionService;
  sessionBindingService: SessionBindingService;
  streamCoordinatorRegistry: StreamCoordinatorRegistry;
  sendText: SendTextFn;
}

export interface RunExecutionInput {
  message: InboundMessage;
  peerKey: string;
  sessionID: string;
}

export class RunExecutionService {
  constructor(private readonly deps: RunExecutionServiceDeps) {}

  async execute(input: RunExecutionInput): Promise<void> {
    const binding = this.deps.sessionBindingService.createRunBinding({
      message: input.message,
      sessionID: input.sessionID,
    });
    binding.initialize();

    try {
      const model = this.deps.modelStore.get(
        input.message.channel,
        input.peerKey,
        this.deps.config.model,
      );

      this.deps.logger.debug(
        {
          sessionID: input.sessionID,
          length: input.message.text.length,
          model,
        },
        'prompt start',
      );

      const { sessionID: promptSessionID, response } =
        await this.deps.promptExecutionService.promptWithSessionRecovery({
          message: input.message,
          peerKey: input.peerKey,
          sessionID: binding.currentSessionID,
          model,
          onSessionRecovered: ({ previousSessionID, nextSessionID }) => {
            this.deps.logger.info(
              {
                oldSessionID: previousSessionID,
                newSessionID: nextSessionID,
              },
              'session recovered and active run rebound',
            );
            binding.rebind(nextSessionID);
          },
        });

      if (promptSessionID !== binding.currentSessionID) {
        this.deps.logger.info(
          {
            oldSessionID: binding.currentSessionID,
            newSessionID: promptSessionID,
          },
          'active run session mismatch detected, rebinding',
        );
        binding.rebind(promptSessionID);
      }

      const promptError = extractPromptResponseError(response);
      if (promptError) {
        throw promptError.raw;
      }

      const parts = response.parts ?? [];
      const textParts = parts.filter(isPromptTextPart);
      this.deps.logger.debug(
        {
          sessionID: promptSessionID,
          partCount: parts.length,
          textCount: textParts.length,
          partTypes: parts.map((part) => part.type),
          ignoredCount: parts.filter(
            (part) => part.type === 'text' && part.ignored,
          ).length,
        },
        'prompt response',
      );

      const reply = textParts
        .map((part) => part.text ?? '')
        .join('\n')
        .trim();
      if (reply) {
        await this.deliverReply(
          binding.runState,
          promptSessionID,
          input.message.peerId,
          reply,
        );
      } else {
        this.deps.logger.debug({ sessionID: promptSessionID }, 'reply empty');
        await this.deps.sendText(
          input.message.channel,
          input.message.peerId,
          'No response generated. Try again.',
          { kind: 'system' },
        );
      }
    } catch (error) {
      const normalizedError = normalizeOpencodeError(error);
      const errorDetails = {
        message: normalizedError?.message ?? String(error),
        name: normalizedError?.name,
        stack:
          error instanceof Error
            ? error.stack?.split('\n').slice(0, 3).join('\n')
            : undefined,
        status: normalizedError?.status,
        code: normalizedError?.code,
      };
      this.deps.logger.error(
        { error: errorDetails, sessionID: binding.currentSessionID },
        'prompt failed',
      );

      const errorMessage = buildOpencodeErrorMessage(error);
      await this.deps.sendText(input.message.channel, input.message.peerId, errorMessage, {
        kind: 'system',
      });
    } finally {
      binding.finalize();
    }
  }

  private async deliverReply(
    runState: RunState,
    sessionID: string,
    peerId: string,
    reply: string,
  ): Promise<void> {
    const coordinator = this.deps.streamCoordinatorRegistry.get(runState.channel);
    const streamedMessageExistedBeforeFinalize = coordinator.hasStreamedMessage(
      runState.sessionID,
    );
    const deliveredByStreamEdit = await coordinator.finalizeReply({
      sessionID: runState.sessionID,
      peerId,
      text: reply,
    });

    if (deliveredByStreamEdit) {
      this.deps.logger.debug(
        {
          sessionID,
          replyLength: reply.length,
        },
        'reply finalized by stream coordinator',
      );
      return;
    }

    const streamedMessageExistsAfterFinalize = coordinator.hasStreamedMessage(
      runState.sessionID,
    );
    if (streamedMessageExistedBeforeFinalize || streamedMessageExistsAfterFinalize) {
      this.deps.logger.warn(
        {
          sessionID,
          replyLength: reply.length,
        },
        'stream finalization failed after chunking; skip fallback send to avoid duplicate message',
      );
      return;
    }

    if (isTelegramRun(runState)) {
      runState.telegram.streamingSuppressed = true;
      this.deps.logger.debug(
        {
          sessionID,
          replyLength: reply.length,
        },
        'stream finalization unavailable; fallback to regular send',
      );
    } else {
      this.deps.logger.debug({ sessionID, replyLength: reply.length }, 'reply built');
    }

    await this.deps.sendText(runState.channel, peerId, reply, {
      kind: 'reply',
    });
  }
}
