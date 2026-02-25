/**
 * @license
 * Copyright 2026 cofy-x
 * SPDX-License-Identifier: Apache-2.0
 */

import type { Logger } from 'pino';

import type {
  Adapter,
  BridgeReporter,
  ChannelName,
  Config,
  ModelRef,
  RunState,
  SendTextFn,
} from '../../../types/index.js';
import type { ChannelHooksRegistry } from '../../stream/channel-hooks.js';
import { MapChannelHooksRegistry } from '../../stream/channel-hooks.js';
import type {
  EventStreamClient,
  EventStreamTypingManager,
} from '../../stream/event-stream.js';
import { startEventStream } from '../../stream/event-stream.js';
import type { StreamCoordinatorRegistry } from '../../stream/stream-coordinator.js';
import { MapStreamCoordinatorRegistry } from '../../stream/stream-coordinator.js';
import { TelegramChannelHooks } from '../../stream/telegram-channel-hooks.js';
import { createTelegramStreamCoordinator } from '../../stream/telegram-stream-coordinator.js';
import { TypingManager } from '../../stream/typing-manager.js';
import { SessionRunRegistry } from '../../state/session-run-registry.js';
import { OutboundDispatcher } from '../outbound-dispatcher.js';
import type { StreamRuntime } from './composition-types.js';

export interface StartEventStreamFn {
  (
    deps: {
      client: EventStreamClient;
      config: Config;
      activeRuns: Map<string, RunState>;
      sessionModels: Map<string, ModelRef>;
      typingManager: EventStreamTypingManager;
      streamCoordinatorRegistry: StreamCoordinatorRegistry;
      channelHooksRegistry: ChannelHooksRegistry;
      reporter?: BridgeReporter;
      sendText: SendTextFn;
    },
    signal: AbortSignal,
  ): Promise<void>;
}

export interface StreamRuntimeFactoryInput {
  config: Config;
  logger: Logger;
  client: EventStreamClient;
  adapters: Map<ChannelName, Adapter>;
  reporter?: BridgeReporter;
  disableEventStream?: boolean;
  startEventStreamFn?: StartEventStreamFn;
}

export class StreamRuntimeFactory {
  constructor(private readonly input: StreamRuntimeFactoryInput) {}

  create(): StreamRuntime {
    const runRegistry = new SessionRunRegistry(this.input.logger);
    const activeRuns = runRegistry.getActiveRuns();
    const sessionModels = new Map<string, ModelRef>();
    const typingManager = new TypingManager(this.input.adapters, this.input.logger);
    const outboundDispatcher = new OutboundDispatcher(
      this.input.adapters,
      this.input.logger,
      this.input.reporter,
    );
    const sendText = outboundDispatcher.sendText;

    const telegramStreamCoordinator = createTelegramStreamCoordinator({
      logger: this.input.logger,
      activeRuns,
      adapters: this.input.adapters,
    });
    const streamCoordinatorRegistry = new MapStreamCoordinatorRegistry(
      new Map([['telegram', telegramStreamCoordinator]]),
    );
    const channelHooksRegistry = new MapChannelHooksRegistry(
      new Map([['telegram', new TelegramChannelHooks()]]),
    );

    const eventAbort = new AbortController();
    if (!this.input.disableEventStream) {
      const startEventStreamFn = this.input.startEventStreamFn ?? startEventStream;
      void startEventStreamFn(
        {
          client: this.input.client,
          config: this.input.config,
          activeRuns,
          sessionModels,
          typingManager,
          streamCoordinatorRegistry,
          channelHooksRegistry,
          reporter: this.input.reporter,
          sendText,
        },
        eventAbort.signal,
      ).catch((error) => {
        this.input.logger.error({ error }, 'event stream closed');
      });
    }

    return {
      runRegistry,
      activeRuns,
      sessionModels,
      typingManager,
      sendText,
      streamCoordinatorRegistry,
      channelHooksRegistry,
      eventAbort,
    };
  }
}
