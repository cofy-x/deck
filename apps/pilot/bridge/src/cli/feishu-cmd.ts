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

export function registerFeishuCommands(program: Command) {
  const feishu = program.command('feishu').description('Feishu helpers');

  registerChannelStatusCommand({
    command: feishu,
    program,
    description: 'Show Feishu status',
    getStatus: () => {
      const config = loadConfig(process.env, { requireOpencode: false });
      return {
        configured: Boolean(config.feishuWebhookUrl),
        enabled: config.feishuEnabled,
        eventPort: config.feishuEventPort,
        eventPath: config.feishuEventPath,
      };
    },
    printText: (status) => {
      console.log(`Feishu configured: ${status.configured ? 'yes' : 'no'}`);
      console.log(`Feishu enabled: ${status.enabled ? 'yes' : 'no'}`);
    },
  });

  registerChannelConfigSetCommand({
    command: feishu,
    program,
    name: 'set-webhook',
    description: 'Set Feishu outgoing webhook URL',
    arguments: [{ required: true, syntax: 'url', description: 'Feishu webhook URL' }],
    run: (url) => {
      const config = loadConfig(process.env, { requireOpencode: false });
      updateConfig(config.configPath, (cfg) => {
        const next: ConfigFile = { ...cfg };
        next.channels = next.channels ?? {};
        next.channels.feishu = {
          ...next.channels.feishu,
          webhookUrl: url,
          enabled: true,
        };
        return next;
      });
      return { success: true, message: 'Feishu webhook saved' };
    },
    toJson: (result) => result,
    toText: (result) => `${result.message}.`,
  });
}
