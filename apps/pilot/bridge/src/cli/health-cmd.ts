/**
 * @license
 * Copyright 2025 cofy-x
 * SPDX-License-Identifier: Apache-2.0
 */

import type { Command } from 'commander';

import { hasWhatsAppCreds } from '../adapters/socket/whatsapp/whatsapp-session.js';
import { buildHealthChannelState } from './channel-status.js';
import { loadConfig } from '../config.js';
import { createClient } from '../opencode.js';
import { formatError } from '../utils.js';
import { getOpts, outputJson } from './helpers.js';

export function registerHealthCommand(program: Command) {
  program
    .command('health')
    .description('Check bridge health (exit 0 if healthy, 1 if not)')
    .action(async () => {
      const useJson = getOpts(program).json;
      const config = loadConfig(process.env, { requireOpencode: false });
      const channelState = buildHealthChannelState(
        config,
        hasWhatsAppCreds(config.whatsappAuthDir),
      );

      try {
        const client = createClient(config);
        const { data: health } = await client.global.health<true>();
        const healthy = Boolean(health.healthy);

        if (useJson) {
          outputJson({
            healthy,
            opencodeUrl: config.opencodeUrl,
            channels: channelState,
          });
        } else {
          console.log(`Healthy: ${healthy ? 'yes' : 'no'}`);
          console.log(`OpenCode URL: ${config.opencodeUrl}`);
        }

        process.exit(healthy ? 0 : 1);
      } catch (error) {
        if (useJson) {
          outputJson({
            healthy: false,
            error: formatError(error),
            opencodeUrl: config.opencodeUrl,
            channels: channelState,
          });
        } else {
          console.log('Healthy: no');
          console.log(`Error: ${formatError(error)}`);
        }
        process.exit(1);
      }
    });
}
