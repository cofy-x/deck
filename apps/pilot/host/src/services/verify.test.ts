/**
 * @license
 * Copyright 2026 cofy-x
 * SPDX-License-Identifier: Apache-2.0
 */

import { beforeEach, describe, expect, test, vi } from 'vitest';

const httpMocks = vi.hoisted(() => ({
  fetchJson: vi.fn(),
}));

vi.mock('../utils/http.js', () => httpMocks);

import { verifyPilotServer } from './verify.js';

describe('verifyPilotServer', () => {
  beforeEach(() => {
    httpMocks.fetchJson.mockReset();
  });

  test('passes when active workspace and opencode credentials match', async () => {
    httpMocks.fetchJson
      .mockResolvedValueOnce({ version: '0.0.1' })
      .mockResolvedValueOnce({
        activeId: 'ws_1',
        items: [
          {
            id: 'ws_1',
            path: '/tmp/workspace',
            opencode: {
              baseUrl: 'http://127.0.0.1:4096',
              directory: '/tmp/workspace',
              username: 'opencode',
              password: 'secret',
            },
          },
        ],
      })
      .mockResolvedValueOnce({ items: [] });

    await expect(
      verifyPilotServer({
        baseUrl: 'http://127.0.0.1:8787',
        token: 'client-token',
        hostToken: 'host-token',
        expectedWorkspace: '/tmp/workspace',
        expectedOpencodeBaseUrl: 'http://127.0.0.1:4096',
        expectedOpencodeDirectory: '/tmp/workspace',
        expectedOpencodeUsername: 'opencode',
        expectedOpencodePassword: 'secret',
      }),
    ).resolves.toBe('0.0.1');
  });

  test('throws when activeId is missing from workspaces response', async () => {
    httpMocks.fetchJson
      .mockResolvedValueOnce({ version: '0.0.1' })
      .mockResolvedValueOnce({
        items: [{ id: 'ws_1', path: '/tmp/workspace' }],
      });

    await expect(
      verifyPilotServer({
        baseUrl: 'http://127.0.0.1:8787',
        token: 'client-token',
        hostToken: 'host-token',
        expectedWorkspace: '/tmp/workspace',
      }),
    ).rejects.toThrow('Pilot server returned no active workspace');
  });

  test('throws when active workspace path does not match expected workspace', async () => {
    httpMocks.fetchJson
      .mockResolvedValueOnce({ version: '0.0.1' })
      .mockResolvedValueOnce({
        activeId: 'ws_2',
        items: [{ id: 'ws_2', path: '/tmp/other-workspace' }],
      });

    await expect(
      verifyPilotServer({
        baseUrl: 'http://127.0.0.1:8787',
        token: 'client-token',
        hostToken: 'host-token',
        expectedWorkspace: '/tmp/workspace',
      }),
    ).rejects.toThrow('Pilot server workspace mismatch');
  });
});
