/**
 * @license
 * Copyright 2025 cofy-x
 * SPDX-License-Identifier: Apache-2.0
 */

import { setTimeout as delay } from 'node:timers/promises';

import type { Logger } from 'pino';

import type {
  BridgeDeps,
  BridgeInstance,
  BridgeReporter,
  Config,
} from '../../types/index.js';
import { BridgeCompositionFactory } from './composition/bridge-composition-factory.js';

// ---------------------------------------------------------------------------
// Bridge entry point
// ---------------------------------------------------------------------------

export async function startBridge(
  config: Config,
  logger: Logger,
  reporter?: BridgeReporter,
  deps: BridgeDeps = {},
): Promise<BridgeInstance> {
  logger.debug(
    {
      configPath: config.configPath,
      opencodeUrl: config.opencodeUrl,
      opencodeDirectory: config.opencodeDirectory,
      telegramEnabled: config.telegramEnabled,
      telegramTokenPresent: Boolean(config.telegramToken),
      slackEnabled: config.slackEnabled,
      slackBotTokenPresent: Boolean(config.slackBotToken),
      slackAppTokenPresent: Boolean(config.slackAppToken),
      whatsappEnabled: config.whatsappEnabled,
      feishuEnabled: config.feishuEnabled,
      discordEnabled: config.discordEnabled,
      dingtalkEnabled: config.dingtalkEnabled,
      emailEnabled: config.emailEnabled,
      mochatEnabled: config.mochatEnabled,
      qqEnabled: config.qqEnabled,
      groupsEnabled: config.groupsEnabled,
      permissionMode: config.permissionMode,
      toolUpdatesEnabled: config.toolUpdatesEnabled,
    },
    'bridge config',
  );

  const compositionFactory = new BridgeCompositionFactory({
    config,
    logger,
    reporter,
    deps,
  });
  const composition = await compositionFactory.compose();

  // -----------------------------------------------------------------------
  // Start adapters
  // -----------------------------------------------------------------------

  await composition.adapterManager.startAll();

  logger.info(
    { channels: Array.from(composition.adapters.keys()) },
    'bridge started',
  );
  reporter?.onStatus?.(`Bridge running. Logs: ${config.logFile}`);

  // -----------------------------------------------------------------------
  // Return bridge instance
  // -----------------------------------------------------------------------

  return {
    async stop() {
      composition.eventAbort.abort();
      composition.healthRuntime.stop();
      composition.typingManager.stopAll();
      await composition.adapterManager.stopAll();
      composition.store.close();
      await delay(50);
    },
    async dispatchInbound(message) {
      await composition.inboundPipeline.dispatchInbound({
        channel: message.channel,
        peerId: message.peerId,
        text: message.text,
        raw: message.raw ?? null,
        fromMe: message.fromMe,
      });
    },
  };
}
