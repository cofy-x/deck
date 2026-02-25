/**
 * @license
 * Copyright 2026 cofy-x
 * SPDX-License-Identifier: Apache-2.0
 */

import type { Logger } from 'pino';

import type { Config, HealthHandlers } from '../../../types/index.js';
import type { AdapterRuntimeManager } from '../adapters/adapter-runtime-manager.js';
import type { HealthConfigStoreLike } from './health-config-store.js';

interface GroupsState {
  get(): boolean;
  set(value: boolean): void;
}

export interface HealthHandlersFactoryInput {
  config: Config;
  logger: Logger;
  configStore: HealthConfigStoreLike;
  adapterManager: Pick<
    AdapterRuntimeManager,
    'reloadTelegramAdapter' | 'reloadSlackAdapter'
  >;
  groupsState: GroupsState;
}

export function createHealthHandlers(input: HealthHandlersFactoryInput): HealthHandlers {
  return {
    getGroupsEnabled: () => input.groupsState.get(),
    setGroupsEnabled: async (enabled: boolean) => {
      input.groupsState.set(enabled);
      input.config.groupsEnabled = enabled;
      input.configStore.persist((current) => ({
        ...current,
        groupsEnabled: enabled,
      }));
      input.logger.info({ groupsEnabled: enabled }, 'groups config updated');
      return { groupsEnabled: enabled };
    },
    setTelegramToken: async (token: string) => {
      const trimmed = token.trim();
      if (!trimmed) throw new Error('Telegram token is required');

      input.configStore.persist((current) => ({
        ...current,
        channels: {
          ...current.channels,
          telegram: {
            ...current.channels?.telegram,
            token: trimmed,
            enabled: true,
          },
        },
      }));

      input.config.telegramToken = trimmed;
      input.config.telegramEnabled = true;
      await input.adapterManager.reloadTelegramAdapter();

      return { configured: true, enabled: true };
    },
    setSlackTokens: async (tokens: { botToken: string; appToken: string }) => {
      const botToken = tokens.botToken.trim();
      const appToken = tokens.appToken.trim();
      if (!botToken || !appToken) {
        throw new Error('Slack bot token and app token are required');
      }

      input.configStore.persist((current) => ({
        ...current,
        channels: {
          ...current.channels,
          slack: {
            ...current.channels?.slack,
            botToken,
            appToken,
            enabled: true,
          },
        },
      }));

      input.config.slackBotToken = botToken;
      input.config.slackAppToken = appToken;
      input.config.slackEnabled = true;
      await input.adapterManager.reloadSlackAdapter();

      return { configured: true, enabled: true };
    },
  };
}
