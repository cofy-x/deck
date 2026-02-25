/**
 * @license
 * Copyright 2026 cofy-x
 * SPDX-License-Identifier: Apache-2.0
 */

import type { DiscordRuntimeDeps } from './types.js';
import { withPatchedDiscordWs } from './ws-proxy-patch.js';

export interface LoadDiscordRuntimeOptions {
  gatewayProxyUrl?: string;
}

interface RuntimeLoaderDeps {
  importRuntime: () => Promise<DiscordRuntimeDeps>;
  withPatchedDiscordWs: typeof withPatchedDiscordWs;
}

export interface DiscordRuntimeLoader {
  load(options: LoadDiscordRuntimeOptions): Promise<DiscordRuntimeDeps>;
  reset(): void;
}

const defaultDeps: RuntimeLoaderDeps = {
  importRuntime: async () => {
    const runtime = await import('discord.js');
    return {
      Client: runtime.Client,
      GatewayIntentBits: runtime.GatewayIntentBits,
      Partials: runtime.Partials,
      Events: runtime.Events,
      ChannelType: runtime.ChannelType,
      DefaultWebSocketManagerOptions: runtime.DefaultWebSocketManagerOptions,
    };
  },
  withPatchedDiscordWs,
};

export function createDiscordRuntimeLoader(
  deps: RuntimeLoaderDeps = defaultDeps,
): DiscordRuntimeLoader {
  let cachedRuntime: DiscordRuntimeDeps | null = null;
  let loadingPromise: Promise<DiscordRuntimeDeps> | null = null;

  async function load(options: LoadDiscordRuntimeOptions): Promise<DiscordRuntimeDeps> {
    if (cachedRuntime) {
      return cachedRuntime;
    }

    if (!loadingPromise) {
      loadingPromise = deps
        .withPatchedDiscordWs(options.gatewayProxyUrl, async () => {
          const runtime = await deps.importRuntime();
          cachedRuntime = runtime;
          return runtime;
        })
        .finally(() => {
          loadingPromise = null;
        });
    }

    return loadingPromise;
  }

  function reset(): void {
    cachedRuntime = null;
    loadingPromise = null;
  }

  return {
    load,
    reset,
  };
}

const sharedRuntimeLoader = createDiscordRuntimeLoader();

export function loadDiscordRuntime(
  options: LoadDiscordRuntimeOptions,
): Promise<DiscordRuntimeDeps> {
  return sharedRuntimeLoader.load(options);
}

export function resetDiscordRuntimeLoaderForTests(): void {
  sharedRuntimeLoader.reset();
}
