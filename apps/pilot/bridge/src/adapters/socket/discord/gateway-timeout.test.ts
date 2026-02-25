/**
 * @license
 * Copyright 2026 cofy-x
 * SPDX-License-Identifier: Apache-2.0
 */

import pino from 'pino';
import { describe, expect, test } from 'vitest';

import {
  createGatewayHandshakeTimeoutController,
} from './gateway-timeout.js';

describe('createGatewayHandshakeTimeoutController', () => {
  test('applies and restores timeout idempotently', () => {
    const logger = pino({ enabled: false });
    const deps = {
      DefaultWebSocketManagerOptions: {
        handshakeTimeout: 30_000,
      },
    };

    const controller = createGatewayHandshakeTimeoutController(deps, 120_000, logger);

    controller.start();
    controller.start();
    expect(deps.DefaultWebSocketManagerOptions.handshakeTimeout).toBe(120_000);

    controller.stop();
    controller.stop();
    expect(deps.DefaultWebSocketManagerOptions.handshakeTimeout).toBe(30_000);
  });

  test('restores timeout in exception flow', () => {
    const logger = pino({ enabled: false });
    const deps = {
      DefaultWebSocketManagerOptions: {
        handshakeTimeout: 30_000,
      },
    };

    const controller = createGatewayHandshakeTimeoutController(deps, 120_000, logger);

    try {
      controller.start();
      throw new Error('simulate startup failure');
    } catch {
      // ignore
    } finally {
      controller.stop();
    }

    expect(deps.DefaultWebSocketManagerOptions.handshakeTimeout).toBe(30_000);
  });

  test('is a no-op when websocket defaults are unavailable', () => {
    const logger = pino({ enabled: false });
    const deps = {
      DefaultWebSocketManagerOptions: undefined,
    };

    const controller = createGatewayHandshakeTimeoutController(deps, 120_000, logger);

    controller.start();
    controller.stop();

    expect(deps.DefaultWebSocketManagerOptions).toBeUndefined();
  });
});
