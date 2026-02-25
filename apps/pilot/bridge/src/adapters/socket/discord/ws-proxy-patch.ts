/**
 * @license
 * Copyright 2026 cofy-x
 * SPDX-License-Identifier: Apache-2.0
 */

import { createRequire } from 'node:module';

import { ProxyAgent as NodeProxyAgent } from 'proxy-agent';

const cjsRequire = createRequire(import.meta.url);
const DISCORD_GATEWAY_HOST = 'gateway.discord.gg';

type WebSocketConstructor = new (
  address: unknown,
  protocols?: unknown,
  options?: Record<string, unknown>,
) => object;

export interface WsModuleLike {
  WebSocket?: WebSocketConstructor;
  default?: unknown;
}

interface WsPatchHandle {
  patched: boolean;
  restore(): void;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function resolveWebSocketCtor(wsModule: WsModuleLike): WebSocketConstructor | null {
  if (wsModule.WebSocket) return wsModule.WebSocket;
  if (typeof wsModule.default === 'function') {
    return wsModule.default as WebSocketConstructor;
  }
  return null;
}

function extractHostname(address: unknown): string | null {
  if (address instanceof URL) return address.hostname;
  if (typeof address !== 'string') return null;
  try {
    return new URL(address).hostname;
  } catch {
    return null;
  }
}

function isDiscordGatewayAddress(address: unknown): boolean {
  const hostname = extractHostname(address);
  return hostname === DISCORD_GATEWAY_HOST;
}

function hasOwnKey(record: Record<string, unknown>, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(record, key);
}

export function patchWsModuleForDiscordGateway(
  wsModule: WsModuleLike,
  proxyUrl: string,
): WsPatchHandle {
  const originalCtor = resolveWebSocketCtor(wsModule);
  if (!originalCtor) {
    return {
      patched: false,
      restore() {
        // no-op
      },
    };
  }

  const proxyAgent = new NodeProxyAgent({
    getProxyForUrl: () => proxyUrl,
  });
  const shouldPatchDefault = wsModule.default === originalCtor;

  // discord.js/@discordjs/ws does not expose a gateway agent hook, so we patch ws constructor.
  const BaseCtor = originalCtor;

  class DiscordGatewayProxyWebSocket extends BaseCtor {
    constructor(
      address: unknown,
      protocols?: unknown,
      options?: Record<string, unknown>,
    ) {
      const optionRecord = isRecord(options) ? options : undefined;
      const hasCustomConnection =
        (optionRecord ? hasOwnKey(optionRecord, 'agent') : false) ||
        (optionRecord ? hasOwnKey(optionRecord, 'createConnection') : false);
      // Scope the injected proxy to Discord gateway only.
      const shouldInject =
        isDiscordGatewayAddress(address) && !hasCustomConnection;

      if (!shouldInject) {
        super(address, protocols, options);
        return;
      }

      const mergedOptions: Record<string, unknown> = {
        ...(optionRecord ?? {}),
        agent: proxyAgent,
      };
      // Keep explicit caller-provided transport behavior when present.
      delete mergedOptions['createConnection'];
      super(address, protocols, mergedOptions);
    }
  }

  wsModule.WebSocket = DiscordGatewayProxyWebSocket as WebSocketConstructor;
  if (shouldPatchDefault) {
    wsModule.default = DiscordGatewayProxyWebSocket as WebSocketConstructor;
  }

  return {
    patched: true,
    restore() {
      wsModule.WebSocket = originalCtor;
      if (shouldPatchDefault) {
        wsModule.default = originalCtor;
      }
    },
  };
}

function loadWsModule(): WsModuleLike | null {
  try {
    return cjsRequire('ws') as WsModuleLike;
  } catch {
    return null;
  }
}

export async function withPatchedDiscordWs<T>(
  proxyUrl: string | undefined,
  run: () => Promise<T>,
): Promise<T> {
  if (!proxyUrl) {
    return run();
  }

  const wsModule = loadWsModule();
  if (!wsModule) {
    return run();
  }

  const patch = patchWsModuleForDiscordGateway(wsModule, proxyUrl);
  try {
    return await run();
  } finally {
    patch.restore();
  }
}
