/**
 * @license
 * Copyright 2026 cofy-x
 * SPDX-License-Identifier: Apache-2.0
 */

import type { Logger } from 'pino';

import type { DiscordRuntimeDeps, DiscordWebSocketDefaults } from './types.js';

const DEFAULT_GATEWAY_HANDSHAKE_TIMEOUT_MS = 30_000;

export interface GatewayHandshakeTimeoutController {
  start(): void;
  stop(): void;
}

function resolveCurrentHandshakeTimeout(wsDefaults: DiscordWebSocketDefaults): number {
  const current = wsDefaults.handshakeTimeout;
  if (typeof current === 'number' && Number.isFinite(current) && current > 0) {
    return current;
  }

  return DEFAULT_GATEWAY_HANDSHAKE_TIMEOUT_MS;
}

export function createGatewayHandshakeTimeoutController(
  deps: Pick<DiscordRuntimeDeps, 'DefaultWebSocketManagerOptions'>,
  timeoutMs: number | undefined,
  logger: Logger,
): GatewayHandshakeTimeoutController {
  let applied = false;
  let previousTimeoutMs: number | null = null;

  return {
    start() {
      if (applied) {
        return;
      }

      if (!timeoutMs) {
        return;
      }

      const wsDefaults = deps.DefaultWebSocketManagerOptions;
      if (!wsDefaults) {
        return;
      }

      const current = resolveCurrentHandshakeTimeout(wsDefaults);
      previousTimeoutMs = current;

      if (current !== timeoutMs) {
        wsDefaults.handshakeTimeout = timeoutMs;
        logger.info(
          { handshakeTimeoutMs: timeoutMs },
          'discord gateway handshake timeout overridden',
        );
      }

      applied = true;
    },

    stop() {
      if (!applied) {
        return;
      }

      const wsDefaults = deps.DefaultWebSocketManagerOptions;
      if (
        wsDefaults &&
        previousTimeoutMs !== null &&
        wsDefaults.handshakeTimeout !== previousTimeoutMs
      ) {
        wsDefaults.handshakeTimeout = previousTimeoutMs;
      }

      previousTimeoutMs = null;
      applied = false;
    },
  };
}
