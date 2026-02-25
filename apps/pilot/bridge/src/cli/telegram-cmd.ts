/**
 * @license
 * Copyright 2025 cofy-x
 * SPDX-License-Identifier: Apache-2.0
 */

import type { Command } from 'commander';

import { loadConfig } from '../config.js';
import type { ConfigFile, TelegramThinkingMode } from '../types/index.js';
import { getOpts, outputJson, updateConfig } from './helpers.js';
import {
  registerChannelConfigSetCommand,
  registerChannelStatusCommand,
} from './channel-command-factory.js';

export function registerTelegramCommands(program: Command) {
  const telegram = program.command('telegram').description('Telegram helpers');

  registerChannelStatusCommand({
    command: telegram,
    program,
    description: 'Show Telegram status',
    getStatus: () => {
      const config = loadConfig(process.env, { requireOpencode: false });
      return {
        configured: Boolean(config.telegramToken),
        enabled: config.telegramEnabled,
        hasToken: Boolean(config.telegramToken),
        thinkingMode: config.telegramThinkingMode ?? 'off',
      };
    },
    printText: (status) => {
      console.log(`Telegram configured: ${status.configured ? 'yes' : 'no'}`);
      console.log(`Telegram enabled: ${status.enabled ? 'yes' : 'no'}`);
      console.log(`Telegram thinking mode: ${status.thinkingMode}`);
    },
  });

  registerChannelConfigSetCommand({
    command: telegram,
    program,
    name: 'set-token',
    description: 'Set Telegram bot token',
    arguments: [{ required: true, syntax: 'token', description: 'Telegram bot token' }],
    run: (token) => {
      const config = loadConfig(process.env, { requireOpencode: false });
      updateConfig(config.configPath, (cfg) => {
        const next: ConfigFile = { ...cfg };
        next.channels = next.channels ?? {};
        next.channels.telegram = {
          ...next.channels.telegram,
          token,
          enabled: true,
        };
        return next;
      });
      return { success: true, message: 'Telegram token saved' };
    },
    toJson: (result) => result,
    toText: (result) => result.message + '.',
  });

  telegram
    .command('set-thinking-mode')
    .argument('<mode>', 'Thinking mode: off | summary | raw_debug')
    .description('Set Telegram thinking output mode')
    .action((mode: string) => {
      const useJson = getOpts(program).json;
      const config = loadConfig(process.env, { requireOpencode: false });
      if (mode !== 'off' && mode !== 'summary' && mode !== 'raw_debug') {
        if (useJson) {
          outputJson({
            success: false,
            error: 'Mode must be one of: off, summary, raw_debug',
          });
        } else {
          console.error('Mode must be one of: off, summary, raw_debug');
        }
        process.exit(1);
      }

      const nextMode = mode as TelegramThinkingMode;
      updateConfig(config.configPath, (cfg) => {
        const next: ConfigFile = { ...cfg };
        next.channels = next.channels ?? {};
        next.channels.telegram = {
          ...next.channels.telegram,
          thinkingMode: nextMode,
        };
        return next;
      });

      if (useJson) {
        outputJson({
          success: true,
          thinkingMode: nextMode,
        });
      } else {
        console.log(`Telegram thinking mode set to: ${nextMode}`);
      }
    });
}
