/**
 * @license
 * Copyright 2026 cofy-x
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, expect, test } from 'vitest';
import { addRoute, matchRoute, parseWorkspaceMount } from './router.js';
import type { Route } from './router.js';

describe('matchRoute', () => {
  test('decodes route parameters', () => {
    const routes: Route[] = [];
    addRoute(routes, 'GET', '/workspace/:id/config', 'client', async () =>
      new Response(null, { status: 200 }),
    );

    const matched = matchRoute(routes, 'GET', '/workspace/ws%201/config');
    expect(matched?.params['id']).toBe('ws 1');
  });

  test('throws 400 for invalid percent-encoded parameter', () => {
    const routes: Route[] = [];
    addRoute(routes, 'GET', '/workspace/:id/config', 'client', async () =>
      new Response(null, { status: 200 }),
    );

    try {
      matchRoute(routes, 'GET', '/workspace/%E0%A4%A/config');
      throw new Error('Expected invalid route parameter error');
    } catch (error) {
      expect(error).toMatchObject({
        status: 400,
        code: 'invalid_route_param',
      });
    }
  });
});

describe('parseWorkspaceMount', () => {
  test('decodes workspace id from /w/:id mount', () => {
    const mount = parseWorkspaceMount('/w/workspace%201/opencode/global/health');
    expect(mount).toMatchObject({
      workspaceId: 'workspace 1',
      restPath: '/opencode/global/health',
    });
  });

  test('throws 400 for invalid workspace id encoding', () => {
    try {
      parseWorkspaceMount('/w/%E0%A4%A/opencode');
      throw new Error('Expected invalid route parameter error');
    } catch (error) {
      expect(error).toMatchObject({
        status: 400,
        code: 'invalid_route_param',
      });
    }
  });
});
