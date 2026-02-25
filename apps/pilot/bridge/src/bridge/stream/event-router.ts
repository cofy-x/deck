/**
 * @license
 * Copyright 2026 cofy-x
 * SPDX-License-Identifier: Apache-2.0
 */

import type {
  BridgeEvent,
  Config,
  ModelRef,
  RunState,
  SendTextFn,
} from '../../types/index.js';
import { reportThinking } from '../support/run-reporting.js';
import type { ChannelHooksRegistry } from './channel-hooks.js';
import { handleSessionIdle } from './session-idle-handler.js';
import type { StreamCoordinatorRegistry } from './stream-coordinator.js';
import { ToolUpdateNotifier } from './tool-update-notifier.js';

interface EventRouterClient {
  permission: {
    respond(parameters: {
      sessionID: string;
      permissionID: string;
      response: 'reject' | 'always' | 'once';
    }): Promise<unknown>;
  };
}

interface EventRouterTypingManager {
  start(run: RunState): void;
  stop(sessionID: string): void;
}

export interface BridgeEventRouterDeps {
  client: EventRouterClient;
  config: Config;
  activeRuns: Map<string, RunState>;
  sessionModels: Map<string, ModelRef>;
  typingManager: EventRouterTypingManager;
  streamCoordinatorRegistry: StreamCoordinatorRegistry;
  channelHooksRegistry: ChannelHooksRegistry;
  sendText: SendTextFn;
  toolUpdateNotifier?: ToolUpdateNotifier;
}

type BridgeEventType = BridgeEvent['type'];

type EventHandler<T extends BridgeEventType> = (
  event: Extract<BridgeEvent, { type: T }>,
  reportStatus?: (message: string) => void,
) => Promise<void>;

type EventHandlerMap = {
  [K in BridgeEventType]?: EventHandler<K>;
};

function extractModelRef(
  event: Extract<BridgeEvent, { type: 'message.updated' }>,
): ModelRef | null {
  const info = event.properties.info;
  if (info.role !== 'user') return null;
  if (!info.model) return null;
  if (
    typeof info.model.providerID !== 'string' ||
    typeof info.model.modelID !== 'string'
  ) {
    return null;
  }
  return { providerID: info.model.providerID, modelID: info.model.modelID };
}

export class BridgeEventRouter {
  private readonly toolUpdateNotifier: ToolUpdateNotifier;

  private readonly handlers: EventHandlerMap;

  constructor(private readonly deps: BridgeEventRouterDeps) {
    this.toolUpdateNotifier =
      deps.toolUpdateNotifier ??
      new ToolUpdateNotifier(deps.config, deps.sendText);
    this.handlers = {
      'message.updated': this.handleMessageUpdated.bind(this),
      'session.status': this.handleSessionStatus.bind(this),
      'session.idle': this.handleSessionIdle.bind(this),
      'message.part.updated': this.handleMessagePartUpdated.bind(this),
      'message.part.delta': this.handleMessagePartDelta.bind(this),
      'permission.asked': this.handlePermissionAsked.bind(this),
    };
  }

  async route(
    event: BridgeEvent,
    reportStatus?: (message: string) => void,
  ): Promise<void> {
    const handler = this.handlers[event.type] as
      | EventHandler<typeof event.type>
      | undefined;
    if (!handler) return;
    await handler(event as never, reportStatus);
  }

  private async handleMessageUpdated(
    event: Extract<BridgeEvent, { type: 'message.updated' }>,
    reportStatus?: (message: string) => void,
  ): Promise<void> {
    const sessionID = event.properties.info.sessionID ?? null;
    const run = sessionID ? this.deps.activeRuns.get(sessionID) : undefined;
    if (run) {
      this.deps.streamCoordinatorRegistry
        .get(run.channel)
        .onMessageUpdated(event.properties.info);
    }

    const model = extractModelRef(event);
    if (sessionID && model) {
      this.deps.sessionModels.set(sessionID, model);
      if (run) {
        reportThinking(run, this.deps.sessionModels, reportStatus);
      }
    }
  }

  private async handleSessionStatus(
    event: Extract<BridgeEvent, { type: 'session.status' }>,
    reportStatus?: (message: string) => void,
  ): Promise<void> {
    const sessionID = event.properties.sessionID ?? null;
    const statusType = event.properties.status?.type;
    if (sessionID && (statusType === 'busy' || statusType === 'retry')) {
      const run = this.deps.activeRuns.get(sessionID);
      if (run) {
        reportThinking(run, this.deps.sessionModels, reportStatus);
        this.deps.typingManager.start(run);
      }
      return;
    }

    if (sessionID && statusType === 'idle') {
      await handleSessionIdle(sessionID, this.deps, reportStatus);
    }
  }

  private async handleSessionIdle(
    event: Extract<BridgeEvent, { type: 'session.idle' }>,
    reportStatus?: (message: string) => void,
  ): Promise<void> {
    const sessionID = event.properties.sessionID ?? null;
    if (!sessionID) return;
    await handleSessionIdle(sessionID, this.deps, reportStatus);
  }

  private async handleMessagePartUpdated(
    event: Extract<BridgeEvent, { type: 'message.part.updated' }>,
  ): Promise<void> {
    const part = event.properties.part;
    const run = this.deps.activeRuns.get(part.sessionID);
    if (!run) return;

    await this.deps.streamCoordinatorRegistry
      .get(run.channel)
      .onMessagePartUpdated({ part });
    await this.deps.channelHooksRegistry.get(run.channel).onMessagePartUpdated({
      run,
      part,
      config: this.deps.config,
      sendText: this.deps.sendText,
    });
    await this.toolUpdateNotifier.notify(run, part);
  }

  private async handleMessagePartDelta(
    event: Extract<BridgeEvent, { type: 'message.part.delta' }>,
  ): Promise<void> {
    const run = this.deps.activeRuns.get(event.properties.sessionID);
    if (!run) return;
    await this.deps.streamCoordinatorRegistry
      .get(run.channel)
      .onMessagePartDelta(event.properties);
  }

  private async handlePermissionAsked(
    event: Extract<BridgeEvent, { type: 'permission.asked' }>,
  ): Promise<void> {
    const { id, sessionID } = event.properties;
    const response = this.deps.config.permissionMode === 'deny' ? 'reject' : 'always';
    await this.deps.client.permission.respond({
      sessionID,
      permissionID: id,
      response,
    });

    if (response !== 'reject') return;

    const run = this.deps.activeRuns.get(sessionID);
    if (!run) return;

    await this.deps.sendText(
      run.channel,
      run.peerId,
      'Permission denied. Update configuration to allow tools.',
      { kind: 'system' },
    );
  }
}
