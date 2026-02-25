/**
 * @license
 * Copyright 2025 cofy-x
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, expect, test } from 'vitest';

import { createAdapterTestConfig } from './test-fixtures.js';
import { ADAPTER_REGISTRY } from './registry.js';

describe('adapter registry', () => {
  test('contains all expected adapter entries', () => {
    const names = ADAPTER_REGISTRY.map((entry) => entry.name).sort();
    expect(names).toEqual([
      'dingtalk',
      'discord',
      'email',
      'feishu',
      'mochat',
      'qq',
      'slack',
      'telegram',
      'whatsapp',
    ]);
  });

  test('all entries are enabled and configured on a fully populated config', () => {
    const config = createAdapterTestConfig();
    for (const entry of ADAPTER_REGISTRY) {
      expect(entry.isEnabled(config)).toBe(true);
      expect(entry.isConfigured(config)).toBe(true);
    }
  });
});
