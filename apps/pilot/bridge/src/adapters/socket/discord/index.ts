/**
 * @license
 * Copyright 2026 cofy-x
 * SPDX-License-Identifier: Apache-2.0
 */

import type { Logger } from 'pino';
import { ProxyAgent as UndiciProxyAgent } from 'undici';

import type { Adapter, Config, MessageHandler } from '../../../types/index.js';
import { isTextChannel, isTypingChannel } from './channel-guards.js';
import { buildDiscordClientOptions } from './client-options.js';
import {
  createGatewayHandshakeTimeoutController,
  type GatewayHandshakeTimeoutController,
} from './gateway-timeout.js';
import { normalizeDiscordInboundMessage } from './inbound-filter.js';
import { resolveIgnoredInboundLog } from './inbound-logging.js';
import {
  resolveDiscordNetworkSettings,
  type DiscordNetworkSettings,
} from './network-settings.js';
import {
  loadDiscordRuntime,
  type LoadDiscordRuntimeOptions,
} from './runtime-loader.js';
import type {
  DiscordMessage,
  DiscordRuntimeClient,
  DiscordRuntimeDeps,
} from './types.js';

export interface DiscordAdapter extends Adapter {
  name: 'discord';
}

export type DiscordDeps = DiscordRuntimeDeps;

const MAX_TEXT_LENGTH = 1_900;

type RuntimeLoader = (
  options: LoadDiscordRuntimeOptions,
) => Promise<DiscordRuntimeDeps>;

export class DiscordAdapterImpl implements DiscordAdapter {
  readonly name = 'discord' as const;

  readonly maxTextLength = MAX_TEXT_LENGTH;

  readonly capabilities = {
    progress: false,
    typing: true,
    file: false,
  } as const;

  private readonly log: Logger;

  private readonly discordToken: string;

  private readonly loadRuntime: RuntimeLoader;

  private readonly proxyDispatcher: UndiciProxyAgent | null;

  private readonly networkSettings: DiscordNetworkSettings;

  private runtimeDeps: DiscordRuntimeDeps | null;

  private gatewayHandshakeTimeoutController: GatewayHandshakeTimeoutController | null = null;

  private client: DiscordRuntimeClient | null = null;

  private started = false;

  constructor(
    private readonly config: Config,
    logger: Logger,
    private readonly onMessage: MessageHandler,
    deps?: DiscordDeps,
    runtimeLoader: RuntimeLoader = loadDiscordRuntime,
  ) {
    this.log = logger.child({ channel: 'discord' });
    this.discordToken = config.discordToken ?? '';
    this.loadRuntime = runtimeLoader;
    this.runtimeDeps = deps ?? null;

    this.networkSettings = resolveDiscordNetworkSettings(config);
    this.proxyDispatcher = this.networkSettings.restProxyUrl
      ? new UndiciProxyAgent(this.networkSettings.restProxyUrl)
      : null;

    this.log.info(
      {
        restProxy: this.networkSettings.restProxyUrl ?? null,
        gatewayProxy: this.networkSettings.gatewayProxyUrl ?? null,
        gatewayProxySource: this.networkSettings.gatewayProxySource,
        handshakeTimeoutMs: this.networkSettings.handshakeTimeoutMs ?? null,
        handshakeTimeoutSource: this.networkSettings.handshakeTimeoutSource,
      },
      'discord startup network config',
    );
  }

  async start(): Promise<void> {
    if (this.started) {
      return;
    }

    const runtimeDeps = await this.ensureRuntimeDeps();
    const timeoutController =
      this.ensureGatewayHandshakeTimeoutController(runtimeDeps);
    timeoutController.start();

    try {
      const client = await this.ensureClient();
      await client.login(this.discordToken);
      this.started = true;
      this.log.info('discord adapter started');
    } catch (error) {
      timeoutController.stop();
      throw error;
    }
  }

  async stop(): Promise<void> {
    const currentClient = this.client;
    if (this.started && currentClient) {
      await currentClient.destroy();
      this.log.info('discord adapter stopped');
    }

    this.started = false;
    this.client = null;
    this.gatewayHandshakeTimeoutController?.stop();
  }

  async sendText(peerId: string, text: string): Promise<void> {
    const client = await this.ensureClient();
    const channel = await client.channels.fetch(peerId);
    if (!isTextChannel(channel)) {
      throw new Error('Discord target channel is not text based');
    }

    await channel.send(text);
  }

  async sendTyping(peerId: string): Promise<void> {
    const client = await this.ensureClient();
    const channel = await client.channels.fetch(peerId);
    if (!isTypingChannel(channel)) {
      return;
    }

    await channel.sendTyping();
  }

  private async ensureRuntimeDeps(): Promise<DiscordRuntimeDeps> {
    if (this.runtimeDeps) {
      return this.runtimeDeps;
    }

    this.runtimeDeps = await this.loadRuntime({
      gatewayProxyUrl: this.networkSettings.gatewayProxyUrl,
    });
    return this.runtimeDeps;
  }

  private ensureGatewayHandshakeTimeoutController(
    deps: DiscordRuntimeDeps,
  ): GatewayHandshakeTimeoutController {
    if (this.gatewayHandshakeTimeoutController) {
      return this.gatewayHandshakeTimeoutController;
    }

    this.gatewayHandshakeTimeoutController =
      createGatewayHandshakeTimeoutController(
        deps,
        this.networkSettings.handshakeTimeoutMs,
        this.log,
      );

    return this.gatewayHandshakeTimeoutController;
  }

  private async ensureClient(): Promise<DiscordRuntimeClient> {
    if (this.client) {
      return this.client;
    }

    const deps = await this.ensureRuntimeDeps();
    const client = new deps.Client(
      buildDiscordClientOptions(deps, this.proxyDispatcher),
    );

    client.on(deps.Events.MessageCreate, (message) => {
      void this.handleInboundMessage(message as DiscordMessage, deps);
    });

    this.client = client;
    return client;
  }

  private async handleInboundMessage(
    message: DiscordMessage,
    deps: DiscordRuntimeDeps,
  ): Promise<void> {
    if (message.author.bot) {
      return;
    }

    const botUserId = this.client?.user?.id ?? null;
    const normalized = normalizeDiscordInboundMessage({
      message,
      groupsEnabled: this.config.groupsEnabled,
      mentionInGuilds: this.config.discordMentionInGuilds,
      botUserId,
      dmChannelType: deps.ChannelType.DM,
    });

    if (!normalized.accepted) {
      const ignored = resolveIgnoredInboundLog(
        normalized.reason,
        message,
        botUserId,
      );
      this.log.debug(ignored.payload, ignored.message);
      return;
    }

    this.log.debug(
      {
        channelId: message.channelId,
        guildId: message.guildId,
        authorId: message.author.id,
        isDirect: normalized.isDirect,
        textLength: normalized.text.length,
      },
      'discord message received',
    );

    try {
      await this.onMessage({
        channel: 'discord',
        peerId: message.channelId,
        text: normalized.text,
        raw: {
          messageId: message.id,
          channelId: message.channelId,
          authorId: message.author.id,
          guildId: message.guildId,
        },
      });
    } catch (error) {
      this.log.error({ error }, 'discord inbound handler failed');
    }
  }
}

export function createDiscordAdapter(
  config: Config,
  logger: Logger,
  onMessage: MessageHandler,
  deps?: DiscordDeps,
): DiscordAdapter {
  if (!config.discordToken) {
    throw new Error('DISCORD_BOT_TOKEN is required for Discord adapter');
  }

  return new DiscordAdapterImpl(config, logger, onMessage, deps);
}
