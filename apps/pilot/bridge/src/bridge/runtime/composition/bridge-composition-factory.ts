/**
 * @license
 * Copyright 2026 cofy-x
 * SPDX-License-Identifier: Apache-2.0
 */

import type { Logger } from 'pino';

import { createClient } from '../../../opencode.js';
import type {
  BridgeDeps,
  BridgeReporter,
  Config,
  MessageHandler,
} from '../../../types/index.js';
import { AdapterRuntimeManager } from '../adapters/adapter-runtime-manager.js';
import type { BridgeComposition } from './composition-types.js';
import { InboundRuntimeFactory } from './inbound-runtime-factory.js';
import { BridgeHealthRuntime } from '../health/bridge-health-runtime.js';
import { SessionFactory } from './session-factory.js';
import { bootstrapStore } from './store-bootstrap.js';
import { StreamRuntimeFactory } from './stream-runtime-factory.js';

export interface BridgeCompositionFactoryInput {
  config: Config;
  logger: Logger;
  reporter?: BridgeReporter;
  deps?: BridgeDeps;
}

export class BridgeCompositionFactory {
  private readonly deps: BridgeDeps;

  constructor(private readonly input: BridgeCompositionFactoryInput) {
    this.deps = input.deps ?? {};
  }

  async compose(): Promise<BridgeComposition> {
    const { config, logger, reporter } = this.input;
    const reportStatus = reporter?.onStatus;
    const client = this.deps.client ?? createClient(config);
    const store = bootstrapStore({
      config,
      store: this.deps.store,
    });

    let inboundPipeline: BridgeComposition['inboundPipeline'] | null = null;
    const handleInbound: MessageHandler = async (message) => {
      if (!inboundPipeline) {
        logger.warn(
          { channel: message.channel, peerId: message.peerId },
          'inbound pipeline not ready yet',
        );
        return;
      }
      await inboundPipeline.handleInbound({
        channel: message.channel,
        peerId: message.peerId,
        text: message.text,
        raw: message.raw ?? null,
        fromMe: message.fromMe,
      });
    };

    const adapterManager = new AdapterRuntimeManager({
      config,
      logger,
      onInbound: handleInbound,
      reporter,
      adapters: this.deps.adapters,
    });
    adapterManager.initialize();
    const adapters = adapterManager.getAdapters();

    const streamRuntime = new StreamRuntimeFactory({
      config,
      logger,
      client,
      adapters,
      reporter,
      disableEventStream: this.deps.disableEventStream,
    }).create();

    const healthRuntime = new BridgeHealthRuntime({
      config,
      logger,
      client,
      adapters,
      adapterManager,
      disableHealthServer: this.deps.disableHealthServer,
    });
    await healthRuntime.start();

    const sessionFactory = new SessionFactory({
      client,
      config,
      store,
      logger,
      sendText: streamRuntime.sendText,
      reportStatus,
    });

    inboundPipeline = new InboundRuntimeFactory({
      config,
      logger,
      client,
      store,
      adapters,
      runRegistry: streamRuntime.runRegistry,
      typingManager: streamRuntime.typingManager,
      streamCoordinatorRegistry: streamRuntime.streamCoordinatorRegistry,
      sessionModels: streamRuntime.sessionModels,
      sendText: streamRuntime.sendText,
      createSession: sessionFactory.create.bind(sessionFactory),
      reportStatus,
      reporter,
    }).create();

    return {
      store,
      adapterManager,
      adapters,
      inboundPipeline,
      healthRuntime,
      typingManager: streamRuntime.typingManager,
      eventAbort: streamRuntime.eventAbort,
    };
  }
}
