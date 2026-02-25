/**
 * @license
 * Copyright 2026 cofy-x
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, expect, test } from 'vitest';

import type { InboundMessage } from '../../types/index.js';
import { resolveAccessIdentity } from './access-identity.js';

interface IdentityCase {
  name: string;
  message: InboundMessage;
  expected: {
    sessionKey: string;
    accessKey: string;
  };
}

function createMessage(overrides: Partial<InboundMessage>): InboundMessage {
  return {
    channel: 'telegram',
    peerId: 'p-1',
    text: 'hello',
    raw: null,
    ...overrides,
  };
}

describe('resolveAccessIdentity', () => {
  const cases: IdentityCase[] = [
    {
      name: 'whatsapp normalizes peer id for session and access',
      message: createMessage({
        channel: 'whatsapp',
        peerId: '8613700000000@s.whatsapp.net',
      }),
      expected: {
        sessionKey: '+8613700000000',
        accessKey: '+8613700000000',
      },
    },
    {
      name: 'telegram private chat uses from.id as access key',
      message: createMessage({
        channel: 'telegram',
        peerId: 'chat-1',
        raw: {
          chat: { type: 'private' },
          from: { id: 42 },
        },
      }),
      expected: {
        sessionKey: 'chat-1',
        accessKey: '42',
      },
    },
    {
      name: 'telegram group uses chat id as access key',
      message: createMessage({
        channel: 'telegram',
        peerId: '-10001',
        raw: {
          chat: { type: 'supergroup' },
          from: { id: 42 },
        },
      }),
      expected: {
        sessionKey: '-10001',
        accessKey: '-10001',
      },
    },
    {
      name: 'slack uses event user id as access key',
      message: createMessage({
        channel: 'slack',
        peerId: 'C123|1700000.100',
        raw: {
          user: 'U999',
        },
      }),
      expected: {
        sessionKey: 'C123|1700000.100',
        accessKey: 'U999',
      },
    },
    {
      name: 'discord uses author id as access key',
      message: createMessage({
        channel: 'discord',
        peerId: 'C1',
        raw: {
          authorId: 'U1',
        },
      }),
      expected: {
        sessionKey: 'C1',
        accessKey: 'U1',
      },
    },
    {
      name: 'feishu prefers sender open_id as access key',
      message: createMessage({
        channel: 'feishu',
        peerId: 'chat_abc',
        raw: {
          event: {
            sender: {
              sender_id: {
                open_id: 'ou_xxx',
                user_id: 'u_yyy',
              },
            },
            message: {
              chat_id: 'chat_abc',
            },
          },
        },
      }),
      expected: {
        sessionKey: 'chat_abc',
        accessKey: 'ou_xxx',
      },
    },
    {
      name: 'dingtalk prefers senderStaffId as access key',
      message: createMessage({
        channel: 'dingtalk',
        peerId: 'conv_1',
        raw: {
          senderStaffId: 'staff_1',
          senderId: 'sender_1',
          conversationId: 'conv_1',
        },
      }),
      expected: {
        sessionKey: 'conv_1',
        accessKey: 'staff_1',
      },
    },
    {
      name: 'email keeps sender address for both keys',
      message: createMessage({
        channel: 'email',
        peerId: 'sender@example.com',
      }),
      expected: {
        sessionKey: 'sender@example.com',
        accessKey: 'sender@example.com',
      },
    },
    {
      name: 'mochat keeps session id for both keys',
      message: createMessage({
        channel: 'mochat',
        peerId: 'session_1',
      }),
      expected: {
        sessionKey: 'session_1',
        accessKey: 'session_1',
      },
    },
    {
      name: 'qq uses payload user_id as access key',
      message: createMessage({
        channel: 'qq',
        peerId: '10086',
        raw: {
          user_id: 114514,
        },
      }),
      expected: {
        sessionKey: '10086',
        accessKey: '114514',
      },
    },
  ];

  test.each(cases)('$name', ({ message, expected }) => {
    expect(resolveAccessIdentity(message)).toEqual(expected);
  });
});
