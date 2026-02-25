/**
 * @license
 * Copyright 2026 cofy-x
 * SPDX-License-Identifier: Apache-2.0
 */

import type {
  BridgeEvent,
  BridgeReporter,
  Config,
  ModelRef,
  RunState,
  SendTextFn,
} from '../../types/index.js';
import type { ChannelHooksRegistry } from './channel-hooks.js';
import { BridgeEventRouter } from './event-router.js';
import type { StreamCoordinatorRegistry } from './stream-coordinator.js';

// ---------------------------------------------------------------------------
// Dependencies
// ---------------------------------------------------------------------------

export interface EventStreamClient {
  event: {
    subscribe(
      _parameters?: undefined,
      options?: { signal?: AbortSignal },
    ): Promise<{ stream: AsyncIterable<BridgeEvent> }>;
  };
  permission: {
    respond(parameters: {
      sessionID: string;
      permissionID: string;
      response: 'reject' | 'always' | 'once';
    }): Promise<unknown>;
  };
}

export interface EventStreamTypingManager {
  start(run: RunState): void;
  stop(sessionID: string): void;
}

export interface EventStreamDeps {
  client: EventStreamClient;
  config: Config;
  activeRuns: Map<string, RunState>;
  sessionModels: Map<string, ModelRef>;
  typingManager: EventStreamTypingManager;
  streamCoordinatorRegistry: StreamCoordinatorRegistry;
  channelHooksRegistry: ChannelHooksRegistry;
  reporter?: BridgeReporter;
  sendText: SendTextFn;
}

// ---------------------------------------------------------------------------
// Event stream subscription
// ---------------------------------------------------------------------------

export class BridgeEventProcessor {
  constructor(private readonly deps: EventStreamDeps) {}

  async start(signal: AbortSignal): Promise<void> {
    const reportStatus = this.deps.reporter?.onStatus;
    const subscription = await this.deps.client.event.subscribe(undefined, { signal });
    const router = new BridgeEventRouter(this.deps);

    for await (const event of subscription.stream) {
      await router.route(event, reportStatus);
    }
  }
}

export async function startEventStream(
  deps: EventStreamDeps,
  signal: AbortSignal,
): Promise<void> {
  const processor = new BridgeEventProcessor(deps);
  await processor.start(signal);
}
