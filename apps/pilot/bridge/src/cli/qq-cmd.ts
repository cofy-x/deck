/**
 * @license
 * Copyright 2025 cofy-x
 * SPDX-License-Identifier: Apache-2.0
 */

import type { Command } from 'commander';

import { loadConfig } from '../config.js';
import type { ConfigFile } from '../types/index.js';
import { updateConfig } from './helpers.js';
import {
  registerChannelConfigSetCommand,
  registerChannelStatusCommand,
} from './channel-command-factory.js';

export function registerQqCommands(program: Command) {
  const qq = program.command('qq').description('QQ helpers');

  registerChannelStatusCommand({
    command: qq,
    program,
    description: 'Show QQ status',
    getStatus: () => {
      const config = loadConfig(process.env, { requireOpencode: false });
      return {
        configured: Boolean(config.qqApiBaseUrl),
        enabled: config.qqEnabled,
        apiBaseUrl: config.qqApiBaseUrl,
        webhookPort: config.qqWebhookPort,
        webhookPath: config.qqWebhookPath,
      };
    },
    printText: (status) => {
      console.log(`QQ configured: ${status.configured ? 'yes' : 'no'}`);
      console.log(`QQ enabled: ${status.enabled ? 'yes' : 'no'}`);
    },
  });

  registerChannelConfigSetCommand({
    command: qq,
    program,
    name: 'set-api',
    description: 'Set QQ API base URL and optional access token',
    arguments: [
      { required: true, syntax: 'baseUrl', description: 'QQ API base URL' },
      { required: false, syntax: 'accessToken', description: 'QQ API access token' },
    ],
    run: (baseUrl, accessToken) => {
      const config = loadConfig(process.env, { requireOpencode: false });
      updateConfig(config.configPath, (cfg) => {
        const next: ConfigFile = { ...cfg };
        next.channels = next.channels ?? {};
        next.channels.qq = {
          ...next.channels.qq,
          apiBaseUrl: baseUrl,
          ...(accessToken?.trim() ? { accessToken: accessToken.trim() } : {}),
          enabled: true,
        };
        return next;
      });
      return { success: true, message: 'QQ API settings saved' };
    },
    toJson: (result) => result,
    toText: (result) => `${result.message}.`,
  });
}
