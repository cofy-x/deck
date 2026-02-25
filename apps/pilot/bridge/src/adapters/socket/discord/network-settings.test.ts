/**
 * @license
 * Copyright 2026 cofy-x
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, expect, test } from 'vitest';

import { resolveDiscordNetworkSettings } from './network-settings.js';

describe('resolveDiscordNetworkSettings', () => {
  test('prefers explicit discordGatewayProxyUrl over rest proxy', () => {
    const settings = resolveDiscordNetworkSettings(
      {
        discordGatewayProxyUrl: 'socks5h://127.0.0.1:7890',
      },
      {
        resolveProxyUrl: () => 'http://127.0.0.1:8080',
      },
    );

    expect(settings.restProxyUrl).toBe('http://127.0.0.1:8080');
    expect(settings.gatewayProxyUrl).toBe('socks5h://127.0.0.1:7890');
    expect(settings.gatewayProxySource).toBe('config');
  });

  test('falls back to rest proxy when gateway proxy is not configured', () => {
    const settings = resolveDiscordNetworkSettings(
      {},
      {
        resolveProxyUrl: () => 'http://127.0.0.1:8080',
      },
    );

    expect(settings.gatewayProxyUrl).toBe('http://127.0.0.1:8080');
    expect(settings.gatewayProxySource).toBe('rest_proxy');
  });

  test('uses configured handshake timeout when provided', () => {
    const settings = resolveDiscordNetworkSettings(
      {
        discordGatewayHandshakeTimeoutMs: 180_000,
      },
      {
        resolveProxyUrl: () => 'http://127.0.0.1:8080',
      },
    );

    expect(settings.handshakeTimeoutMs).toBe(180_000);
    expect(settings.handshakeTimeoutSource).toBe('config');
  });

  test('uses default proxy handshake timeout when proxy is enabled', () => {
    const settings = resolveDiscordNetworkSettings(
      {},
      {
        resolveProxyUrl: () => 'http://127.0.0.1:8080',
      },
    );

    expect(settings.handshakeTimeoutMs).toBe(120_000);
    expect(settings.handshakeTimeoutSource).toBe('gateway_proxy_default');
  });
});
