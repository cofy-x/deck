/**
 * @license
 * Copyright 2026 cofy-x
 * SPDX-License-Identifier: Apache-2.0
 */

import pino from 'pino';
import { describe, expect, test, vi } from 'vitest';

import type { BridgeStore } from '../../../db.js';
import type { OpencodeClient } from '../../../opencode.js';
import type { Adapter, ChannelName, Config } from '../../../types/index.js';
import { createBridgeTestConfig } from '../../stream/test-fixtures.js';
import { BridgeCompositionFactory } from './bridge-composition-factory.js';

function createAdapter(name: Adapter['name']): Adapter {
  return {
    name,
    maxTextLength: 4000,
    capabilities: {
      progress: false,
      typing: false,
      file: false,
    },
    start: async () => undefined,
    stop: async () => undefined,
    sendText: async () => undefined,
  };
}

function createStoreStub(): BridgeStore {
  return {
    seedAllowlist: vi.fn(),
    prunePairingRequests: vi.fn(),
    close: vi.fn(),
  } as unknown as BridgeStore;
}

function createEmptyEventStream(): AsyncIterable<never> {
  return {
    [Symbol.asyncIterator]() {
      return {
        async next() {
          return { done: true, value: undefined as never };
        },
      };
    },
  };
}

function createClientStub(subscribeSpy: ReturnType<typeof vi.fn>): OpencodeClient {
  return {
    event: {
      subscribe: subscribeSpy,
    },
    permission: {
      respond: vi.fn(async () => undefined),
    },
    global: {
      health: vi.fn(async () => ({
        data: {
          healthy: true,
          version: 'test-version',
        },
      })),
    },
    session: {
      create: vi.fn(async () => ({ data: { id: 'ses_1' } })),
      prompt: vi.fn(async () => ({ data: { parts: [] } })),
    },
  } as unknown as OpencodeClient;
}

describe('BridgeCompositionFactory', () => {
  test('composes runtime graph with event stream disabled', async () => {
    const logger = pino({ enabled: false });
    const config: Config = {
      ...createBridgeTestConfig(),
      healthPort: undefined,
    };
    const subscribe = vi.fn(async () => ({
      stream: createEmptyEventStream(),
    }));
    const client = createClientStub(subscribe);
    const store = createStoreStub();
    const adapters = new Map<ChannelName, Adapter>([
      ['telegram', createAdapter('telegram')],
    ]);

    const factory = new BridgeCompositionFactory({
      config,
      logger,
      deps: {
        client,
        store,
        adapters,
        disableEventStream: true,
        disableHealthServer: true,
      },
    });

    const composition = await factory.compose();

    expect(composition.store).toBe(store);
    expect(composition.adapters).toBe(adapters);
    expect(composition.inboundPipeline).toBeDefined();
    expect(composition.typingManager).toBeDefined();
    expect(subscribe).not.toHaveBeenCalled();

    composition.healthRuntime.stop();
  });

  test('starts event stream when event streaming is enabled', async () => {
    const logger = pino({ enabled: false });
    const config: Config = {
      ...createBridgeTestConfig(),
      healthPort: undefined,
    };
    const subscribe = vi.fn(async () => ({
      stream: createEmptyEventStream(),
    }));
    const client = createClientStub(subscribe);
    const store = createStoreStub();
    const adapters = new Map<ChannelName, Adapter>([
      ['telegram', createAdapter('telegram')],
    ]);

    const factory = new BridgeCompositionFactory({
      config,
      logger,
      deps: {
        client,
        store,
        adapters,
        disableHealthServer: true,
      },
    });

    const composition = await factory.compose();
    await Promise.resolve();

    expect(subscribe).toHaveBeenCalledTimes(1);

    composition.eventAbort.abort();
    composition.healthRuntime.stop();
  });
});
