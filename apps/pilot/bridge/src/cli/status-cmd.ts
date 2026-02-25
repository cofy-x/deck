/**
 * @license
 * Copyright 2025 cofy-x
 * SPDX-License-Identifier: Apache-2.0
 */

import type { Command } from 'commander';

import {
  isDingTalkConfigured,
  isDiscordConfigured,
  isEmailConfigured,
  isFeishuConfigured,
  isMochatConfigured,
  isQqConfigured,
  isSlackConfigured,
  isTelegramConfigured,
} from '../channel-config.js';
import { hasWhatsAppCreds } from '../adapters/socket/whatsapp/whatsapp-session.js';
import { buildStatusChannelState } from './channel-status.js';
import { loadConfig } from '../config.js';
import { outputJson } from './helpers.js';
import { runCommand } from './command-runner.js';

export function registerStatusCommand(program: Command) {
  program
    .command('status')
    .description('Show WhatsApp, Telegram, and OpenCode status')
    .action(() =>
      runCommand(program, async ({ useJson }) => {
        const config = loadConfig(process.env, { requireOpencode: false });
        const whatsappLinked = hasWhatsAppCreds(config.whatsappAuthDir);

        if (useJson) {
          const channels = buildStatusChannelState(config, whatsappLinked);
          outputJson({
            config: config.configPath,
            healthPort: config.healthPort ?? null,
            ...channels,
            opencode: {
              url: config.opencodeUrl,
              directory: config.opencodeDirectory,
            },
          });
          return;
        }

        console.log(`Config: ${config.configPath}`);
        console.log(`Health port: ${config.healthPort ?? '(not set)'}`);
        console.log(`WhatsApp linked: ${whatsappLinked ? 'yes' : 'no'}`);
        console.log(
          `WhatsApp access policy: ${config.channelAccessPolicy.whatsapp}`,
        );
        console.log(
          `Telegram configured: ${isTelegramConfigured(config) ? 'yes' : 'no'}`,
        );
        console.log(`Telegram thinking mode: ${config.telegramThinkingMode ?? 'off'}`);
        console.log(`Slack configured: ${isSlackConfigured(config) ? 'yes' : 'no'}`);
        console.log(
          `Feishu configured: ${isFeishuConfigured(config) ? 'yes' : 'no'}`,
        );
        console.log(
          `Discord configured: ${isDiscordConfigured(config) ? 'yes' : 'no'}`,
        );
        console.log(
          `DingTalk configured: ${isDingTalkConfigured(config) ? 'yes' : 'no'}`,
        );
        console.log(`Email configured: ${isEmailConfigured(config) ? 'yes' : 'no'}`);
        console.log(`Mochat configured: ${isMochatConfigured(config) ? 'yes' : 'no'}`);
        console.log(`QQ configured: ${isQqConfigured(config) ? 'yes' : 'no'}`);
        console.log(`Auth dir: ${config.whatsappAuthDir}`);
        console.log(`OpenCode URL: ${config.opencodeUrl}`);
      }),
    );
}
