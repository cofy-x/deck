/**
 * @license
 * Copyright 2026 cofy-x
 * SPDX-License-Identifier: Apache-2.0
 */

import pino from 'pino';
import { describe, expect, test } from 'vitest';

import { createAdapterTestConfig } from '../test-fixtures.js';
import { createMochatAdapter } from './mochat.js';

describe('createMochatAdapter', () => {
  test('start fails when claw token is missing', async () => {
    const logger = pino({ enabled: false });
    const config = createAdapterTestConfig({ mochatClawToken: undefined });

    const adapter = createMochatAdapter(config, logger, async () => undefined);
    await expect(adapter.start()).rejects.toThrow(
      'MOCHAT_CLAW_TOKEN is required for Mochat adapter',
    );
  });

  test('start is safe when sessions are empty and stop is idempotent', async () => {
    const logger = pino({ enabled: false });
    const config = createAdapterTestConfig({ mochatSessions: [] });

    const adapter = createMochatAdapter(config, logger, async () => undefined);
    await expect(adapter.start()).resolves.toBeUndefined();
    await expect(adapter.stop()).resolves.toBeUndefined();
    await expect(adapter.stop()).resolves.toBeUndefined();
  });
});
