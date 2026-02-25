/**
 * @license
 * Copyright 2026 cofy-x
 * SPDX-License-Identifier: Apache-2.0
 */

import { resolveProxyUrl } from '../../../utils.js';

const DISCORD_API_BASE_URL = 'https://discord.com/api/v10';
const PROXY_GATEWAY_HANDSHAKE_TIMEOUT_MS = 120_000;

export type GatewayProxySource = 'config' | 'rest_proxy' | 'none';
export type HandshakeTimeoutSource = 'config' | 'gateway_proxy_default' | 'none';

export interface DiscordNetworkConfig {
  discordGatewayProxyUrl?: string;
  discordGatewayHandshakeTimeoutMs?: number;
}

export interface DiscordNetworkSettings {
  restProxyUrl?: string;
  gatewayProxyUrl?: string;
  gatewayProxySource: GatewayProxySource;
  handshakeTimeoutMs?: number;
  handshakeTimeoutSource: HandshakeTimeoutSource;
}

interface DiscordNetworkSettingsDeps {
  resolveProxyUrl(url: string): string | undefined;
}

const defaultDeps: DiscordNetworkSettingsDeps = {
  resolveProxyUrl,
};

function normalizeNonEmptyString(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function normalizePositiveInteger(value: number | undefined): number | undefined {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return undefined;
  }

  const rounded = Math.trunc(value);
  return rounded > 0 ? rounded : undefined;
}

export function resolveDiscordNetworkSettings(
  config: DiscordNetworkConfig,
  deps: DiscordNetworkSettingsDeps = defaultDeps,
): DiscordNetworkSettings {
  const restProxyUrl = deps.resolveProxyUrl(DISCORD_API_BASE_URL);

  const configuredGatewayProxyUrl = normalizeNonEmptyString(
    config.discordGatewayProxyUrl,
  );
  const gatewayProxyUrl = configuredGatewayProxyUrl ?? restProxyUrl;
  const gatewayProxySource: GatewayProxySource = configuredGatewayProxyUrl
    ? 'config'
    : restProxyUrl
      ? 'rest_proxy'
      : 'none';

  const configuredHandshakeTimeoutMs = normalizePositiveInteger(
    config.discordGatewayHandshakeTimeoutMs,
  );
  const handshakeTimeoutMs =
    configuredHandshakeTimeoutMs ??
    (gatewayProxyUrl ? PROXY_GATEWAY_HANDSHAKE_TIMEOUT_MS : undefined);
  const handshakeTimeoutSource: HandshakeTimeoutSource = configuredHandshakeTimeoutMs
    ? 'config'
    : gatewayProxyUrl
      ? 'gateway_proxy_default'
      : 'none';

  return {
    restProxyUrl,
    gatewayProxyUrl,
    gatewayProxySource,
    handshakeTimeoutMs,
    handshakeTimeoutSource,
  };
}
