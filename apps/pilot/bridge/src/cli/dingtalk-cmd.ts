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

export function registerDingTalkCommands(program: Command) {
  const dingtalk = program.command('dingtalk').description('DingTalk helpers');

  registerChannelStatusCommand({
    command: dingtalk,
    program,
    description: 'Show DingTalk status',
    getStatus: () => {
      const config = loadConfig(process.env, { requireOpencode: false });
      return {
        configured: Boolean(config.dingtalkWebhookUrl),
        enabled: config.dingtalkEnabled,
        hasSignSecret: Boolean(config.dingtalkSignSecret),
        hasVerificationToken: Boolean(config.dingtalkVerificationToken),
        eventPort: config.dingtalkEventPort,
        eventPath: config.dingtalkEventPath,
      };
    },
    printText: (status) => {
      console.log(`DingTalk configured: ${status.configured ? 'yes' : 'no'}`);
      console.log(`DingTalk enabled: ${status.enabled ? 'yes' : 'no'}`);
      console.log(`DingTalk sign secret: ${status.hasSignSecret ? 'yes' : 'no'}`);
      console.log(
        `DingTalk verification token: ${status.hasVerificationToken ? 'yes' : 'no'}`,
      );
    },
  });

  registerChannelConfigSetCommand({
    command: dingtalk,
    program,
    name: 'set-webhook',
    description: 'Set DingTalk outgoing webhook URL',
    arguments: [{ required: true, syntax: 'url', description: 'DingTalk webhook URL' }],
    run: (url) => {
      const config = loadConfig(process.env, { requireOpencode: false });
      updateConfig(config.configPath, (cfg) => {
        const next: ConfigFile = { ...cfg };
        next.channels = next.channels ?? {};
        next.channels.dingtalk = {
          ...next.channels.dingtalk,
          webhookUrl: url,
          enabled: true,
        };
        return next;
      });
      return { success: true, message: 'DingTalk webhook saved' };
    },
    toJson: (result) => result,
    toText: (result) => `${result.message}.`,
  });

  registerChannelConfigSetCommand({
    command: dingtalk,
    program,
    name: 'set-sign-secret',
    description: 'Set DingTalk webhook signing secret',
    arguments: [
      { required: true, syntax: 'secret', description: 'DingTalk sign secret' },
    ],
    run: (secret) => {
      const config = loadConfig(process.env, { requireOpencode: false });
      updateConfig(config.configPath, (cfg) => {
        const next: ConfigFile = { ...cfg };
        next.channels = next.channels ?? {};
        next.channels.dingtalk = {
          ...next.channels.dingtalk,
          signSecret: secret,
        };
        return next;
      });
      return { success: true, message: 'DingTalk sign secret saved' };
    },
    toJson: (result) => result,
    toText: (result) => `${result.message}.`,
  });

  registerChannelConfigSetCommand({
    command: dingtalk,
    program,
    name: 'set-verification-token',
    description: 'Set DingTalk inbound verification token',
    arguments: [
      {
        required: true,
        syntax: 'token',
        description: 'DingTalk verification token',
      },
    ],
    run: (token) => {
      const config = loadConfig(process.env, { requireOpencode: false });
      updateConfig(config.configPath, (cfg) => {
        const next: ConfigFile = { ...cfg };
        next.channels = next.channels ?? {};
        next.channels.dingtalk = {
          ...next.channels.dingtalk,
          verificationToken: token,
        };
        return next;
      });
      return { success: true, message: 'DingTalk verification token saved' };
    },
    toJson: (result) => result,
    toText: (result) => `${result.message}.`,
  });
}
