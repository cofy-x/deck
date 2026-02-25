/**
 * @license
 * Copyright 2026 cofy-x
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, expect, test } from 'vitest';

import {
  parseArgs,
  readApprovalMode,
  readPort,
  readTimeoutMs,
} from './args.js';

describe('args readers', () => {
  test('readApprovalMode throws on invalid value', () => {
    const parsed = parseArgs(['--approval', 'invalid']);
    expect(() =>
      readApprovalMode(parsed.flags, 'approval', 'manual', 'PILOT_APPROVAL_MODE'),
    ).toThrow('Use manual|auto');
  });

  test('readPort validates integer and range', () => {
    expect(() =>
      readPort(parseArgs(['--pilot-port', 'abc']).flags, 'pilot-port', 8787),
    ).toThrow('Expected integer');
    expect(() =>
      readPort(parseArgs(['--pilot-port', '70000']).flags, 'pilot-port', 8787),
    ).toThrow('Must be <= 65535');
    expect(() =>
      readPort(parseArgs(['--pilot-port', '0']).flags, 'pilot-port', 8787),
    ).toThrow('Must be >= 1');
    expect(
      readPort(parseArgs(['--pilot-port', '8787']).flags, 'pilot-port', 8787),
    ).toBe(8787);
  });

  test('readTimeoutMs validates positive integer', () => {
    expect(() =>
      readTimeoutMs(
        parseArgs(['--approval-timeout', '10.5']).flags,
        'approval-timeout',
        30_000,
      ),
    ).toThrow('Expected integer');
    expect(() =>
      readTimeoutMs(
        parseArgs(['--approval-timeout', '0']).flags,
        'approval-timeout',
        30_000,
      ),
    ).toThrow('Must be >= 1');
    expect(
      readTimeoutMs(
        parseArgs(['--approval-timeout', '30000']).flags,
        'approval-timeout',
        30_000,
      ),
    ).toBe(30_000);
  });
});
