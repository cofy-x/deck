/**
 * @license
 * Copyright 2026 cofy-x
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, expect, test } from 'vitest';

import { normalizeBridgeHealthSnapshot } from './bridge-health.js';

describe('normalizeBridgeHealthSnapshot', () => {
  test('normalizes full 9-channel payload', () => {
    const payload = {
      ok: true,
      opencode: {
        url: 'http://127.0.0.1:4096',
        healthy: true,
        version: '1.0.0',
      },
      channels: {
        telegram: true,
        whatsapp: false,
        slack: true,
        feishu: true,
        discord: false,
        dingtalk: true,
        email: false,
        mochat: true,
        qq: false,
      },
      config: { groupsEnabled: true },
    };

    const result = normalizeBridgeHealthSnapshot(payload);
    expect(result.channels.feishu).toBe(true);
    expect(result.channels.qq).toBe(false);
    expect(result.opencode.version).toBe('1.0.0');
  });

  test('normalizes legacy payload and fills missing channels as false', () => {
    const payload = {
      ok: true,
      opencode: {
        url: 'http://127.0.0.1:4096',
        healthy: true,
      },
      channels: {
        telegram: true,
        whatsapp: true,
        slack: false,
      },
      config: { groupsEnabled: false },
    };

    const result = normalizeBridgeHealthSnapshot(payload);
    expect(result.channels.telegram).toBe(true);
    expect(result.channels.whatsapp).toBe(true);
    expect(result.channels.slack).toBe(false);
    expect(result.channels.feishu).toBe(false);
    expect(result.channels.discord).toBe(false);
    expect(result.channels.dingtalk).toBe(false);
    expect(result.channels.email).toBe(false);
    expect(result.channels.mochat).toBe(false);
    expect(result.channels.qq).toBe(false);
  });

  test('throws when payload has invalid field types', () => {
    const payload = {
      ok: true,
      opencode: {
        url: 'http://127.0.0.1:4096',
        healthy: true,
      },
      channels: {
        telegram: true,
        whatsapp: true,
        slack: false,
        discord: 'yes',
      },
      config: { groupsEnabled: true },
    };

    expect(() => normalizeBridgeHealthSnapshot(payload)).toThrow(
      'channels.discord must be boolean',
    );
  });
});
