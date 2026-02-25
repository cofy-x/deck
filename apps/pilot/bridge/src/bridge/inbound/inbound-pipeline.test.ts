/**
 * @license
 * Copyright 2026 cofy-x
 * SPDX-License-Identifier: Apache-2.0
 */

import pino from 'pino';
import { describe, expect, test, vi } from 'vitest';

import type { BridgeStore, PairingRow } from '../../db.js';
import type { Adapter, Config, InboundMessage } from '../../types/index.js';
import { ModelStore } from '../state/model-store.js';
import { AccessControlService } from './access-control-service.js';
import { InboundPipeline } from './inbound-pipeline.js';
import { SessionRunRegistry } from '../state/session-run-registry.js';
import type { InboundCommandService } from './inbound-command-service.js';
import type { RunExecutionService } from './run-execution-service.js';
import type { SessionBindingService } from './session-binding-service.js';
import { TelegramInboundDeduper } from './telegram-inbound-deduper.js';

function createConfig(overrides: Partial<Config> = {}): Config {
  const channelAccessPolicy: Config['channelAccessPolicy'] = {
    telegram: 'open',
    whatsapp: 'open',
    slack: 'open',
    feishu: 'open',
    discord: 'open',
    dingtalk: 'open',
    email: 'open',
    mochat: 'open',
    qq: 'open',
  };
  return {
    allowlist: {
      telegram: new Set<string>(),
      whatsapp: new Set<string>(),
      slack: new Set<string>(),
      feishu: new Set<string>(),
      discord: new Set<string>(),
      dingtalk: new Set<string>(),
      email: new Set<string>(),
      mochat: new Set<string>(),
      qq: new Set<string>(),
    },
    channelAccessPolicy,
    whatsappAllowFrom: new Set<string>(),
    whatsappSelfChatMode: false,
    toolUpdatesEnabled: false,
    model: undefined,
    ...overrides,
  } as unknown as Config;
}

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

function createMessage(overrides: Partial<InboundMessage> = {}): InboundMessage {
  return {
    channel: 'telegram',
    peerId: '7350281763',
    text: 'hello',
    raw: null,
    ...overrides,
  };
}

function createStoreStub(overrides: Partial<BridgeStore> = {}): BridgeStore {
  return {
    getSession: vi.fn(() => null),
    isAllowed: vi.fn(() => true),
    prunePairingRequests: vi.fn(),
    getPairingRequest: vi.fn(() => null),
    listPairingRequests: vi.fn(() => []),
    createPairingRequest: vi.fn(),
    ...overrides,
  } as unknown as BridgeStore;
}

describe('InboundPipeline', () => {
  test('ignores duplicate telegram inbound events via deduper', async () => {
    const sendText = vi.fn(async () => undefined);
    const store = createStoreStub({
      getSession: vi.fn(() => ({
        channel: 'telegram' as const,
        peer_id: '7350281763',
        session_id: 'ses_1',
        created_at: 1,
        updated_at: 1,
      })),
    });
    const config = createConfig();

    const resolvedSession = { sessionID: 'ses_1', reused: true };
    const sessionBindingService = {
      resolveSession: vi.fn(async () => resolvedSession),
    } as unknown as SessionBindingService;
    const inboundCommandService = {
      maybeHandle: vi.fn(async () => false),
    } as unknown as InboundCommandService;
    const runExecutionService = {
      execute: vi.fn(async () => undefined),
    } as unknown as RunExecutionService;
    const accessControlService = new AccessControlService({
      config,
      logger: pino({ enabled: false }),
      store,
      sendText,
    });
    const runRegistry = new SessionRunRegistry(pino({ enabled: false }));
    const pipeline = new InboundPipeline({
      config,
      logger: pino({ enabled: false }),
      adapters: new Map([['telegram', createAdapter('telegram')]]),
      store,
      modelStore: new ModelStore(),
      runRegistry,
      accessControlService,
      inboundCommandService,
      sessionBindingService,
      runExecutionService,
      telegramInboundDeduper: new TelegramInboundDeduper(),
      sendText,
    });
    const message = createMessage({
      raw: {
        message_id: 99,
        chat: { id: 12345 },
      },
    });

    await pipeline.dispatchInbound(message);
    await pipeline.dispatchInbound(message);

    expect(sessionBindingService.resolveSession).toHaveBeenCalledTimes(1);
    expect(runExecutionService.execute).toHaveBeenCalledTimes(1);
  });

  test('denies message when channel policy is allowlist and peer is not approved', async () => {
    const sendText = vi.fn(async () => undefined);
    const store = createStoreStub({
      isAllowed: vi.fn(() => false),
    });
    const config = createConfig({
      channelAccessPolicy: {
        telegram: 'allowlist',
        whatsapp: 'open',
        slack: 'open',
        feishu: 'open',
        discord: 'open',
        dingtalk: 'open',
        email: 'open',
        mochat: 'open',
        qq: 'open',
      },
    });

    const sessionBindingService = {
      resolveSession: vi.fn(),
    } as unknown as SessionBindingService;
    const inboundCommandService = {
      maybeHandle: vi.fn(async () => false),
    } as unknown as InboundCommandService;
    const runExecutionService = {
      execute: vi.fn(),
    } as unknown as RunExecutionService;
    const accessControlService = new AccessControlService({
      config,
      logger: pino({ enabled: false }),
      store,
      sendText,
    });

    const pipeline = new InboundPipeline({
      config,
      logger: pino({ enabled: false }),
      adapters: new Map([['telegram', createAdapter('telegram')]]),
      store,
      modelStore: new ModelStore(),
      runRegistry: new SessionRunRegistry(pino({ enabled: false })),
      accessControlService,
      inboundCommandService,
      sessionBindingService,
      runExecutionService,
      telegramInboundDeduper: new TelegramInboundDeduper(),
      sendText,
    });

    await pipeline.handleInbound(createMessage());

    expect(sendText).toHaveBeenCalledWith('telegram', '7350281763', 'Access denied.', {
      kind: 'system',
    });
    expect(sessionBindingService.resolveSession).not.toHaveBeenCalled();
    expect(runExecutionService.execute).not.toHaveBeenCalled();
  });

  test('returns pairing queue full when whatsapp pairing queue reaches capacity', async () => {
    const sendText = vi.fn(async () => undefined);
    const store = createStoreStub({
      isAllowed: vi.fn(() => false),
      getPairingRequest: vi.fn(() => null),
      listPairingRequests: vi.fn((): PairingRow[] => [
        {
          channel: 'whatsapp',
          peer_id: 'a',
          code: '111111',
          created_at: 1,
          expires_at: 2,
        },
        {
          channel: 'whatsapp',
          peer_id: 'b',
          code: '222222',
          created_at: 1,
          expires_at: 2,
        },
        {
          channel: 'whatsapp',
          peer_id: 'c',
          code: '333333',
          created_at: 1,
          expires_at: 2,
        },
      ]),
      createPairingRequest: vi.fn(),
    });
    const config = createConfig({
      channelAccessPolicy: {
        telegram: 'open',
        whatsapp: 'pairing',
        slack: 'open',
        feishu: 'open',
        discord: 'open',
        dingtalk: 'open',
        email: 'open',
        mochat: 'open',
        qq: 'open',
      },
    });

    const sessionBindingService = {
      resolveSession: vi.fn(),
    } as unknown as SessionBindingService;
    const inboundCommandService = {
      maybeHandle: vi.fn(async () => false),
    } as unknown as InboundCommandService;
    const runExecutionService = {
      execute: vi.fn(),
    } as unknown as RunExecutionService;
    const accessControlService = new AccessControlService({
      config,
      logger: pino({ enabled: false }),
      store,
      sendText,
    });

    const pipeline = new InboundPipeline({
      config,
      logger: pino({ enabled: false }),
      adapters: new Map([['whatsapp', createAdapter('whatsapp')]]),
      store,
      modelStore: new ModelStore(),
      runRegistry: new SessionRunRegistry(pino({ enabled: false })),
      accessControlService,
      inboundCommandService,
      sessionBindingService,
      runExecutionService,
      telegramInboundDeduper: new TelegramInboundDeduper(),
      sendText,
    });

    await pipeline.handleInbound(
      createMessage({
        channel: 'whatsapp',
        peerId: '+1234567890',
      }),
    );

    expect(sendText).toHaveBeenCalledWith(
      'whatsapp',
      '+1234567890',
      'Pairing queue full. Ask the owner to approve pending requests.',
      { kind: 'system' },
    );
    expect(store.createPairingRequest).not.toHaveBeenCalled();
    expect(sessionBindingService.resolveSession).not.toHaveBeenCalled();
  });

  test('creates pairing request using discord author id as access key', async () => {
    const sendText = vi.fn(async () => undefined);
    const store = createStoreStub({
      isAllowed: vi.fn(() => false),
      getPairingRequest: vi.fn(() => null),
      createPairingRequest: vi.fn(),
    });
    const config = createConfig({
      channelAccessPolicy: {
        telegram: 'open',
        whatsapp: 'open',
        slack: 'open',
        feishu: 'open',
        discord: 'pairing',
        dingtalk: 'open',
        email: 'open',
        mochat: 'open',
        qq: 'open',
      },
    });

    const sessionBindingService = {
      resolveSession: vi.fn(),
    } as unknown as SessionBindingService;
    const inboundCommandService = {
      maybeHandle: vi.fn(async () => false),
    } as unknown as InboundCommandService;
    const runExecutionService = {
      execute: vi.fn(),
    } as unknown as RunExecutionService;
    const accessControlService = new AccessControlService({
      config,
      logger: pino({ enabled: false }),
      store,
      sendText,
    });

    const pipeline = new InboundPipeline({
      config,
      logger: pino({ enabled: false }),
      adapters: new Map([['discord', createAdapter('discord')]]),
      store,
      modelStore: new ModelStore(),
      runRegistry: new SessionRunRegistry(pino({ enabled: false })),
      accessControlService,
      inboundCommandService,
      sessionBindingService,
      runExecutionService,
      telegramInboundDeduper: new TelegramInboundDeduper(),
      sendText,
    });

    await pipeline.handleInbound(
      createMessage({
        channel: 'discord',
        peerId: 'C1',
        raw: {
          authorId: 'U1',
        },
      }),
    );

    expect(store.createPairingRequest).toHaveBeenCalledWith(
      'discord',
      'U1',
      expect.any(String),
      60 * 60_000,
    );
    expect(sessionBindingService.resolveSession).not.toHaveBeenCalled();
  });

  test('denies when access key is not allowlisted even if session key is allowlisted', async () => {
    const sendText = vi.fn(async () => undefined);
    const sessionPeerKey = 'C1|1700000.1';
    const store = createStoreStub({
      isAllowed: vi.fn((channel, peerId) => channel === 'slack' && peerId === sessionPeerKey),
    });
    const config = createConfig({
      channelAccessPolicy: {
        telegram: 'open',
        whatsapp: 'open',
        slack: 'allowlist',
        feishu: 'open',
        discord: 'open',
        dingtalk: 'open',
        email: 'open',
        mochat: 'open',
        qq: 'open',
      },
    });

    const resolvedSession = { sessionID: 'ses_1', reused: false };
    const sessionBindingService = {
      resolveSession: vi.fn(async () => resolvedSession),
    } as unknown as SessionBindingService;
    const inboundCommandService = {
      maybeHandle: vi.fn(async () => false),
    } as unknown as InboundCommandService;
    const runExecutionService = {
      execute: vi.fn(async () => undefined),
    } as unknown as RunExecutionService;
    const accessControlService = new AccessControlService({
      config,
      logger: pino({ enabled: false }),
      store,
      sendText,
    });

    const pipeline = new InboundPipeline({
      config,
      logger: pino({ enabled: false }),
      adapters: new Map([['slack', createAdapter('slack')]]),
      store,
      modelStore: new ModelStore(),
      runRegistry: new SessionRunRegistry(pino({ enabled: false })),
      accessControlService,
      inboundCommandService,
      sessionBindingService,
      runExecutionService,
      telegramInboundDeduper: new TelegramInboundDeduper(),
      sendText,
    });

    const message = createMessage({
      channel: 'slack',
      peerId: sessionPeerKey,
      raw: {
        user: 'U1',
      },
    });
    await pipeline.handleInbound(message);

    expect(store.isAllowed).toHaveBeenCalledWith('slack', 'U1');
    expect(sessionBindingService.resolveSession).not.toHaveBeenCalled();
    expect(sendText).toHaveBeenCalledWith(
      'slack',
      sessionPeerKey,
      'Access denied.',
      { kind: 'system' },
    );
  });

  test('degrades unsupported pairing channels to allowlist deny', async () => {
    const sendText = vi.fn(async () => undefined);
    const store = createStoreStub({
      isAllowed: vi.fn(() => false),
      createPairingRequest: vi.fn(),
    });
    const config = createConfig({
      channelAccessPolicy: {
        telegram: 'open',
        whatsapp: 'open',
        slack: 'open',
        feishu: 'open',
        discord: 'open',
        dingtalk: 'pairing',
        email: 'open',
        mochat: 'open',
        qq: 'open',
      },
    });

    const sessionBindingService = {
      resolveSession: vi.fn(),
    } as unknown as SessionBindingService;
    const inboundCommandService = {
      maybeHandle: vi.fn(async () => false),
    } as unknown as InboundCommandService;
    const runExecutionService = {
      execute: vi.fn(),
    } as unknown as RunExecutionService;
    const accessControlService = new AccessControlService({
      config,
      logger: pino({ enabled: false }),
      store,
      sendText,
    });

    const pipeline = new InboundPipeline({
      config,
      logger: pino({ enabled: false }),
      adapters: new Map([['dingtalk', createAdapter('dingtalk')]]),
      store,
      modelStore: new ModelStore(),
      runRegistry: new SessionRunRegistry(pino({ enabled: false })),
      accessControlService,
      inboundCommandService,
      sessionBindingService,
      runExecutionService,
      telegramInboundDeduper: new TelegramInboundDeduper(),
      sendText,
    });

    await pipeline.handleInbound(
      createMessage({
        channel: 'dingtalk',
        peerId: 'conversation-1',
        raw: {
          senderStaffId: 'staff-1',
        },
      }),
    );

    expect(sendText).toHaveBeenCalledWith(
      'dingtalk',
      'conversation-1',
      'Access denied.',
      { kind: 'system' },
    );
    expect(store.createPairingRequest).not.toHaveBeenCalled();
  });
});
