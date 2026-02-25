/**
 * @license
 * Copyright 2026 cofy-x
 * SPDX-License-Identifier: Apache-2.0
 */

import type { ProxyAgent as UndiciProxyAgent } from 'undici';

import type { DiscordClientOptions, DiscordRuntimeDeps } from './types.js';

export function buildDiscordClientOptions(
  deps: Pick<DiscordRuntimeDeps, 'GatewayIntentBits' | 'Partials'>,
  restProxyDispatcher: UndiciProxyAgent | null,
): DiscordClientOptions {
  const options: DiscordClientOptions = {
    intents: [
      deps.GatewayIntentBits.Guilds,
      deps.GatewayIntentBits.GuildMessages,
      deps.GatewayIntentBits.DirectMessages,
      deps.GatewayIntentBits.MessageContent,
    ],
    partials: [deps.Partials.Channel],
  };

  if (restProxyDispatcher) {
    // discord.js currently expects @discordjs/rest's undici type; keep this adaptation in one place.
    options.rest = {
      agent: restProxyDispatcher as never,
    };
  }

  return options;
}
