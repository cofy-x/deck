/**
 * @license
 * Copyright 2026 cofy-x
 * SPDX-License-Identifier: Apache-2.0
 */

export type DiscordClientOptions = import('discord.js').ClientOptions;
export type DiscordMessage = import('discord.js').Message;

// Minimal runtime contract used by adapter/test injection.
export interface DiscordRuntimeClient {
  login(token: string): Promise<unknown>;
  destroy(): Promise<unknown>;
  channels: {
    fetch(peerId: string): Promise<unknown>;
  };
  user?: {
    id: string;
  } | null;
  on(event: string, listener: (message: unknown) => void): void;
}

export interface DiscordWebSocketDefaults {
  handshakeTimeout?: number | null;
}

// Runtime surface consumed from discord.js.
export interface DiscordRuntimeDeps {
  Client: new (options: DiscordClientOptions) => DiscordRuntimeClient;
  GatewayIntentBits: {
    Guilds: number;
    GuildMessages: number;
    DirectMessages: number;
    MessageContent: number;
  };
  Partials: {
    Channel: number;
  };
  Events: {
    MessageCreate: string;
  };
  ChannelType: {
    DM: number;
  };
  DefaultWebSocketManagerOptions?: DiscordWebSocketDefaults;
}
