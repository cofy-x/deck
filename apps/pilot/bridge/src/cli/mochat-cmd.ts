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

export function registerMochatCommands(program: Command) {
  const mochat = program.command('mochat').description('Mochat helpers');

  registerChannelStatusCommand({
    command: mochat,
    program,
    description: 'Show Mochat status',
    getStatus: () => {
      const config = loadConfig(process.env, { requireOpencode: false });
      return {
        configured: Boolean(config.mochatClawToken),
        enabled: config.mochatEnabled,
        baseUrl: config.mochatBaseUrl,
        sessions: config.mochatSessions,
      };
    },
    printText: (status) => {
      console.log(`Mochat configured: ${status.configured ? 'yes' : 'no'}`);
      console.log(`Mochat enabled: ${status.enabled ? 'yes' : 'no'}`);
    },
  });

  registerChannelConfigSetCommand({
    command: mochat,
    program,
    name: 'set-token',
    description: 'Set Mochat claw token',
    arguments: [{ required: true, syntax: 'token', description: 'Mochat claw token' }],
    run: (token) => {
      const config = loadConfig(process.env, { requireOpencode: false });
      updateConfig(config.configPath, (cfg) => {
        const next: ConfigFile = { ...cfg };
        next.channels = next.channels ?? {};
        next.channels.mochat = {
          ...next.channels.mochat,
          clawToken: token,
          enabled: true,
        };
        return next;
      });
      return { success: true, message: 'Mochat token saved' };
    },
    toJson: (result) => result,
    toText: (result) => `${result.message}.`,
  });

  registerChannelConfigSetCommand({
    command: mochat,
    program,
    name: 'set-sessions',
    description: 'Set Mochat watched sessions list',
    arguments: [
      {
        required: true,
        syntax: 'sessionIds',
        description: 'Comma separated Mochat session IDs',
      },
    ],
    run: (sessionIds) => {
      const config = loadConfig(process.env, { requireOpencode: false });
      const values = sessionIds
        .split(',')
        .map((value) => value.trim())
        .filter(Boolean);

      updateConfig(config.configPath, (cfg) => {
        const next: ConfigFile = { ...cfg };
        next.channels = next.channels ?? {};
        next.channels.mochat = {
          ...next.channels.mochat,
          sessions: values,
          enabled: true,
        };
        return next;
      });
      return { success: true, sessions: values };
    },
    toJson: (result) => result,
    toText: (result) => `Mochat sessions saved (${result.sessions.length}).`,
  });
}
