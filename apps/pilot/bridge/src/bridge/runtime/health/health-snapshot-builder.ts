/**
 * @license
 * Copyright 2026 cofy-x
 * SPDX-License-Identifier: Apache-2.0
 */

import type {
  Adapter,
  ChannelName,
  Config,
  HealthSnapshot,
} from '../../../types/index.js';

export interface BuildHealthSnapshotInput {
  config: Config;
  adapters: Map<ChannelName, Adapter>;
  opencodeHealthy: boolean;
  opencodeVersion?: string;
  groupsEnabled: boolean;
}

export function buildHealthSnapshot(input: BuildHealthSnapshotInput): HealthSnapshot {
  return {
    ok: input.opencodeHealthy,
    opencode: {
      url: input.config.opencodeUrl,
      healthy: input.opencodeHealthy,
      version: input.opencodeVersion,
    },
    channels: {
      telegram: input.adapters.has('telegram'),
      whatsapp: input.adapters.has('whatsapp'),
      slack: input.adapters.has('slack'),
      feishu: input.adapters.has('feishu'),
      discord: input.adapters.has('discord'),
      dingtalk: input.adapters.has('dingtalk'),
      email: input.adapters.has('email'),
      mochat: input.adapters.has('mochat'),
      qq: input.adapters.has('qq'),
    },
    config: {
      groupsEnabled: input.groupsEnabled,
    },
  };
}
