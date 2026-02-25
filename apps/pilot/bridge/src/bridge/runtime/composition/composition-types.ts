/**
 * @license
 * Copyright 2026 cofy-x
 * SPDX-License-Identifier: Apache-2.0
 */

import type {
  Adapter,
  ChannelName,
  ModelRef,
  SendTextFn,
} from '../../../types/index.js';
import type { BridgeStore } from '../../../db.js';
import type { InboundPipeline } from '../../inbound/inbound-pipeline.js';
import type { AdapterRuntimeManager } from '../adapters/adapter-runtime-manager.js';
import type { BridgeHealthRuntime } from '../health/bridge-health-runtime.js';
import type { ChannelHooksRegistry } from '../../stream/channel-hooks.js';
import type { StreamCoordinatorRegistry } from '../../stream/stream-coordinator.js';
import type { SessionRunRegistry } from '../../state/session-run-registry.js';
import type { TypingManager } from '../../stream/typing-manager.js';

export interface BridgeComposition {
  store: BridgeStore;
  adapterManager: AdapterRuntimeManager;
  adapters: Map<ChannelName, Adapter>;
  inboundPipeline: InboundPipeline;
  healthRuntime: BridgeHealthRuntime;
  typingManager: TypingManager;
  eventAbort: AbortController;
}

export interface StreamRuntime {
  runRegistry: SessionRunRegistry;
  activeRuns: ReturnType<SessionRunRegistry['getActiveRuns']>;
  sessionModels: Map<string, ModelRef>;
  typingManager: TypingManager;
  sendText: SendTextFn;
  streamCoordinatorRegistry: StreamCoordinatorRegistry;
  channelHooksRegistry: ChannelHooksRegistry;
  eventAbort: AbortController;
}
