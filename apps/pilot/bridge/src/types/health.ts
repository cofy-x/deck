/**
 * @license
 * Copyright 2025 cofy-x
 * SPDX-License-Identifier: Apache-2.0
 */

// ---------------------------------------------------------------------------
// Health server types
// ---------------------------------------------------------------------------

export interface HealthSnapshot {
  ok: boolean;
  opencode: {
    url: string;
    healthy: boolean;
    version?: string;
  };
  channels: {
    telegram: boolean;
    whatsapp: boolean;
    slack: boolean;
    feishu: boolean;
    discord: boolean;
    dingtalk: boolean;
    email: boolean;
    mochat: boolean;
    qq: boolean;
  };
  config: {
    groupsEnabled: boolean;
  };
}

export interface TelegramTokenResult {
  configured: boolean;
  enabled: boolean;
}

export interface SlackTokensResult {
  configured: boolean;
  enabled: boolean;
}

export interface GroupsConfigResult {
  groupsEnabled: boolean;
}

export interface HealthHandlers {
  setTelegramToken?: (token: string) => Promise<TelegramTokenResult>;
  setSlackTokens?: (tokens: {
    botToken: string;
    appToken: string;
  }) => Promise<SlackTokensResult>;
  setGroupsEnabled?: (enabled: boolean) => Promise<GroupsConfigResult>;
  getGroupsEnabled?: () => boolean;
}
