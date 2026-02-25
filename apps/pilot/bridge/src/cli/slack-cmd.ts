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

export function registerSlackCommands(program: Command) {
  const slack = program.command('slack').description('Slack helpers');

  registerChannelStatusCommand({
    command: slack,
    program,
    description: 'Show Slack status',
    getStatus: () => {
      const config = loadConfig(process.env, { requireOpencode: false });
      const configured = Boolean(config.slackBotToken && config.slackAppToken);
      return {
        configured,
        enabled: config.slackEnabled,
        hasBotToken: Boolean(config.slackBotToken),
        hasAppToken: Boolean(config.slackAppToken),
      };
    },
    printText: (status) => {
      console.log(`Slack configured: ${status.configured ? 'yes' : 'no'}`);
      console.log(`Slack enabled: ${status.enabled ? 'yes' : 'no'}`);
    },
  });

  registerChannelConfigSetCommand({
    command: slack,
    program,
    name: 'set-tokens',
    description: 'Set Slack bot/app tokens',
    arguments: [
      { required: true, syntax: 'botToken', description: 'Slack bot token (xoxb-...)' },
      { required: true, syntax: 'appToken', description: 'Slack app token (xapp-...)' },
    ],
    run: (botToken, appToken) => {
      const config = loadConfig(process.env, { requireOpencode: false });
      updateConfig(config.configPath, (cfg) => {
        const next: ConfigFile = { ...cfg };
        next.channels = next.channels ?? {};
        next.channels.slack = { botToken, appToken, enabled: true };
        return next;
      });
      return { success: true, message: 'Slack tokens saved' };
    },
    toJson: (result) => result,
    toText: (result) => `${result.message}.`,
  });
}
