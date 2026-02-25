/**
 * @license
 * Copyright 2026 cofy-x
 * SPDX-License-Identifier: Apache-2.0
 */

import type { Logger } from 'pino';

import type { BridgeStore } from '../../../db.js';
import type {
  Adapter,
  BridgeReporter,
  ChannelName,
  Config,
  InboundMessage,
  ModelRef,
  SendTextFn,
} from '../../../types/index.js';
import type { OpencodeClient } from '../../../opencode.js';
import { AccessControlService } from '../../inbound/access-control-service.js';
import { InboundCommandService } from '../../inbound/inbound-command-service.js';
import { InboundPipeline } from '../../inbound/inbound-pipeline.js';
import { PromptExecutionService } from '../../inbound/prompt-execution-service.js';
import { RunExecutionService } from '../../inbound/run-execution-service.js';
import { SessionBindingService } from '../../inbound/session-binding-service.js';
import { TelegramInboundDeduper } from '../../inbound/telegram-inbound-deduper.js';
import { ModelStore } from '../../state/model-store.js';
import type { SessionRunRegistry } from '../../state/session-run-registry.js';
import type { StreamCoordinatorRegistry } from '../../stream/stream-coordinator.js';
import type { TypingManager } from '../../stream/typing-manager.js';

export interface InboundRuntimeFactoryInput {
  config: Config;
  logger: Logger;
  client: OpencodeClient;
  store: BridgeStore;
  adapters: Map<ChannelName, Adapter>;
  runRegistry: SessionRunRegistry;
  typingManager: TypingManager;
  streamCoordinatorRegistry: StreamCoordinatorRegistry;
  sessionModels: Map<string, ModelRef>;
  sendText: SendTextFn;
  createSession: (
    message: InboundMessage,
    options?: { announce?: boolean; reason?: 'initial' | 'recovery' },
  ) => Promise<string>;
  reportStatus?: (message: string) => void;
  reporter?: BridgeReporter;
}

export class InboundRuntimeFactory {
  constructor(private readonly input: InboundRuntimeFactoryInput) {}

  create(): InboundPipeline {
    const modelStore = new ModelStore();
    const promptExecutionService = new PromptExecutionService({
      client: this.input.client,
      store: this.input.store,
      logger: this.input.logger,
      createSession: this.input.createSession,
    });
    const accessControlService = new AccessControlService({
      config: this.input.config,
      logger: this.input.logger,
      store: this.input.store,
      sendText: this.input.sendText,
    });
    const sessionBindingService = new SessionBindingService({
      config: this.input.config,
      logger: this.input.logger,
      store: this.input.store,
      runRegistry: this.input.runRegistry,
      typingManager: this.input.typingManager,
      streamCoordinatorRegistry: this.input.streamCoordinatorRegistry,
      sessionModels: this.input.sessionModels,
      createSession: this.input.createSession,
      reportStatus: this.input.reportStatus,
    });
    const runExecutionService = new RunExecutionService({
      config: this.input.config,
      logger: this.input.logger,
      modelStore,
      promptExecutionService,
      sessionBindingService,
      streamCoordinatorRegistry: this.input.streamCoordinatorRegistry,
      sendText: this.input.sendText,
    });
    const inboundCommandService = new InboundCommandService({
      config: this.input.config,
      store: this.input.store,
      modelStore,
      logger: this.input.logger,
      sendText: this.input.sendText,
    });
    const telegramInboundDeduper = new TelegramInboundDeduper();

    return new InboundPipeline({
      config: this.input.config,
      logger: this.input.logger,
      adapters: this.input.adapters,
      store: this.input.store,
      modelStore,
      runRegistry: this.input.runRegistry,
      accessControlService,
      inboundCommandService,
      sessionBindingService,
      runExecutionService,
      telegramInboundDeduper,
      sendText: this.input.sendText,
      reporter: this.input.reporter,
    });
  }
}
