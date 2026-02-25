/**
 * @license
 * Copyright 2026 cofy-x
 * SPDX-License-Identifier: Apache-2.0
 */

import type {
  Config,
  ModelRef,
  RunState,
  SendTextFn,
} from '../../types/index.js';
import { reportDone } from '../support/run-reporting.js';
import type { ChannelHooksRegistry } from './channel-hooks.js';
import type { StreamCoordinatorRegistry } from './stream-coordinator.js';

export interface SessionIdleTypingManager {
  stop(sessionID: string): void;
}

export interface SessionIdleHandlerDeps {
  activeRuns: Map<string, RunState>;
  sessionModels: Map<string, ModelRef>;
  typingManager: SessionIdleTypingManager;
  streamCoordinatorRegistry: StreamCoordinatorRegistry;
  channelHooksRegistry: ChannelHooksRegistry;
  config: Config;
  sendText: SendTextFn;
}

export async function handleSessionIdle(
  sessionID: string,
  deps: SessionIdleHandlerDeps,
  reportStatus?: (message: string) => void,
): Promise<void> {
  const run = deps.activeRuns.get(sessionID);
  if (!run) {
    deps.typingManager.stop(sessionID);
    return;
  }

  await deps.streamCoordinatorRegistry.get(run.channel).onSessionIdle(sessionID);
  deps.typingManager.stop(sessionID);

  await deps.channelHooksRegistry.get(run.channel).onSessionIdle({
    run,
    config: deps.config,
    sendText: deps.sendText,
  });
  reportDone(run, deps.sessionModels, reportStatus);
}
