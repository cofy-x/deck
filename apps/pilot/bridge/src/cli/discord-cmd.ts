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

export function registerDiscordCommands(program: Command) {
  const discord = program.command('discord').description('Discord helpers');

  registerChannelStatusCommand({
    command: discord,
    program,
    description: 'Show Discord status',
    getStatus: () => {
      const config = loadConfig(process.env, { requireOpencode: false });
      return {
        configured: Boolean(config.discordToken),
        enabled: config.discordEnabled,
        mentionInGuilds: config.discordMentionInGuilds,
      };
    },
    printText: (status) => {
      console.log(`Discord configured: ${status.configured ? 'yes' : 'no'}`);
      console.log(`Discord enabled: ${status.enabled ? 'yes' : 'no'}`);
    },
  });

  registerChannelConfigSetCommand({
    command: discord,
    program,
    name: 'set-token',
    description: 'Set Discord bot token',
    arguments: [{ required: true, syntax: 'token', description: 'Discord bot token' }],
    run: (token) => {
      const config = loadConfig(process.env, { requireOpencode: false });
      updateConfig(config.configPath, (cfg) => {
        const next: ConfigFile = { ...cfg };
        next.channels = next.channels ?? {};
        next.channels.discord = {
          ...next.channels.discord,
          token,
          enabled: true,
        };
        return next;
      });
      return { success: true, message: 'Discord token saved' };
    },
    toJson: (result) => result,
    toText: (result) => `${result.message}.`,
  });
}
