/**
 * @license
 * Copyright 2026 cofy-x
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, expect, test } from 'vitest';

import {
  patchWsModuleForDiscordGateway,
  type WsModuleLike,
} from './ws-proxy-patch.js';

interface ConstructorCall {
  address: unknown;
  options: Record<string, unknown> | undefined;
}

class FakeWebSocket {
  static calls: ConstructorCall[] = [];

  constructor(
    address: unknown,
    _protocols?: unknown,
    options?: Record<string, unknown>,
  ) {
    FakeWebSocket.calls.push({
      address,
      options,
    });
  }

  static reset(): void {
    FakeWebSocket.calls = [];
  }
}

function createWsModule(): WsModuleLike {
  return {
    WebSocket: FakeWebSocket,
    default: FakeWebSocket,
  };
}

describe('patchWsModuleForDiscordGateway', () => {
  test('restores original WebSocket constructor after patch lifecycle', () => {
    FakeWebSocket.reset();
    const wsModule = createWsModule();
    const originalWebSocket = wsModule.WebSocket;

    const patch = patchWsModuleForDiscordGateway(
      wsModule,
      'socks5h://127.0.0.1:7890',
    );

    expect(patch.patched).toBe(true);
    expect(wsModule.WebSocket).not.toBe(originalWebSocket);

    patch.restore();

    expect(wsModule.WebSocket).toBe(originalWebSocket);
    expect(wsModule.default).toBe(originalWebSocket);
  });

  test('injects proxy agent only for Discord gateway host', () => {
    FakeWebSocket.reset();
    const wsModule = createWsModule();
    const patch = patchWsModuleForDiscordGateway(
      wsModule,
      'socks5h://127.0.0.1:7890',
    );
    const PatchedWebSocket = wsModule.WebSocket;

    if (!PatchedWebSocket) {
      throw new Error('expected patched websocket constructor');
    }

    // No explicit agent/createConnection, so proxy agent should be injected.
    new PatchedWebSocket('wss://gateway.discord.gg/?v=10&encoding=json');

    const firstCall = FakeWebSocket.calls[0];
    expect(firstCall).toBeDefined();
    expect(firstCall?.address).toBe('wss://gateway.discord.gg/?v=10&encoding=json');
    expect(firstCall?.options?.['agent']).toBeDefined();

    patch.restore();
  });

  test('does not inject proxy agent for non-discord hosts', () => {
    FakeWebSocket.reset();
    const wsModule = createWsModule();
    const patch = patchWsModuleForDiscordGateway(
      wsModule,
      'socks5h://127.0.0.1:7890',
    );
    const PatchedWebSocket = wsModule.WebSocket;

    if (!PatchedWebSocket) {
      throw new Error('expected patched websocket constructor');
    }

    new PatchedWebSocket('wss://example.com/socket');

    const firstCall = FakeWebSocket.calls[0];
    expect(firstCall).toBeDefined();
    expect(firstCall?.address).toBe('wss://example.com/socket');
    expect(firstCall?.options?.['agent']).toBeUndefined();

    patch.restore();
  });

  test('keeps explicit websocket agent options untouched', () => {
    FakeWebSocket.reset();
    const wsModule = createWsModule();
    const patch = patchWsModuleForDiscordGateway(
      wsModule,
      'socks5h://127.0.0.1:7890',
    );
    const PatchedWebSocket = wsModule.WebSocket;

    if (!PatchedWebSocket) {
      throw new Error('expected patched websocket constructor');
    }

    const explicitAgent = { marker: 'custom-agent' };
    new PatchedWebSocket('wss://gateway.discord.gg/?v=10&encoding=json', undefined, {
      agent: explicitAgent,
    });

    const firstCall = FakeWebSocket.calls[0];
    expect(firstCall?.options?.['agent']).toBe(explicitAgent);

    patch.restore();
  });
});
