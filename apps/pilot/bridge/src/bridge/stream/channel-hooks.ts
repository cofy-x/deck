/**
 * @license
 * Copyright 2026 cofy-x
 * SPDX-License-Identifier: Apache-2.0
 */

import type {
  ChannelName,
  Config,
  MessagePartProps,
  RunState,
  SendTextFn,
} from '../../types/index.js';

export interface MessagePartUpdatedHookInput {
  run: RunState;
  part: MessagePartProps['part'];
  config: Config;
  sendText: SendTextFn;
}

export interface SessionIdleHookInput {
  run: RunState;
  config: Config;
  sendText: SendTextFn;
}

export interface ChannelHooks {
  onMessagePartUpdated(input: MessagePartUpdatedHookInput): Promise<void>;
  onSessionIdle(input: SessionIdleHookInput): Promise<void>;
}

export class DefaultChannelHooks implements ChannelHooks {
  async onMessagePartUpdated(_input: MessagePartUpdatedHookInput): Promise<void> {
    return;
  }

  async onSessionIdle(_input: SessionIdleHookInput): Promise<void> {
    return;
  }
}

const DEFAULT_HOOKS = new DefaultChannelHooks();

export interface ChannelHooksRegistry {
  get(channel: ChannelName): ChannelHooks;
}

export class MapChannelHooksRegistry implements ChannelHooksRegistry {
  private readonly hooks: Map<ChannelName, ChannelHooks>;

  constructor(hooks: Map<ChannelName, ChannelHooks>) {
    this.hooks = hooks;
  }

  get(channel: ChannelName): ChannelHooks {
    return this.hooks.get(channel) ?? DEFAULT_HOOKS;
  }
}
