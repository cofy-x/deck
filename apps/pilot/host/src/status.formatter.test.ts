/**
 * @license
 * Copyright 2026 cofy-x
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, expect, test } from 'vitest';

import { formatStatusText } from './status/formatter.js';
import type { StatusResult } from './types/index.js';

describe('status formatter', () => {
  test('formats services in stable order with grouped bridge channels and summary', () => {
    const status: StatusResult = {
      bridge: {
        ok: true,
        url: 'http://127.0.0.1:3005',
        health: {
          ok: true,
          opencode: { url: 'http://127.0.0.1:4096', healthy: true },
          channels: {
            telegram: true,
            whatsapp: false,
            slack: true,
            feishu: false,
            discord: false,
            dingtalk: false,
            email: true,
            mochat: false,
            qq: false,
          },
          config: { groupsEnabled: true },
        },
      },
      pilot: { ok: true, url: 'http://127.0.0.1:8787' },
      opencode: { ok: false, url: 'http://127.0.0.1:4096', error: 'timeout' },
    };

    const output = formatStatusText(status);
    const lines = output.trimEnd().split('\n');
    expect(lines[0]).toBe('Pilot server: ok (http://127.0.0.1:8787)');
    expect(lines[1]).toBe('OpenCode server: error (http://127.0.0.1:4096)');
    expect(lines[2]).toBe('  timeout');
    expect(lines[3]).toBe('Bridge: ok (http://127.0.0.1:3005)');
    expect(output).toContain('  Bridge channels:');
    expect(output).toContain('enabled (3): telegram, slack, email');
    expect(output).toContain(
      'disabled (6): whatsapp, feishu, discord, dingtalk, mochat, qq',
    );
    expect(output).toContain('Summary: 2/3 services healthy');
  });

  test('prints empty summary when no services were checked', () => {
    expect(formatStatusText({})).toContain('Summary: no services checked');
  });
});
