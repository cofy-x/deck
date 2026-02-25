/**
 * @license
 * Copyright 2026 cofy-x
 * SPDX-License-Identifier: Apache-2.0
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { invoke } from '@tauri-apps/api/core';

import {
  pilotRuntimeHealth,
  pilotRuntimeStart,
  pilotRuntimeStatus,
  pilotRuntimeStop,
  type PilotRuntimeHealth,
  type PilotRuntimeStatus,
} from './pilot-runtime';

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(),
}));

const mockedInvoke = vi.mocked(invoke);

const runtimeStatus: PilotRuntimeStatus = {
  running: true,
  workspacePath: '/tmp/ws',
  opencodeUrl: 'http://127.0.0.1:4096',
  opencodeUsername: 'opencode',
  opencodePassword: 'secret',
  hostDataDir: '/tmp/pilot-host',
  bridgeHealthPort: 3005,
  components: {
    host: {
      running: true,
      pid: 111,
      url: 'http://127.0.0.1:43110',
      lastStdout: null,
      lastStderr: null,
    },
    server: {
      running: true,
      pid: 222,
      url: 'http://127.0.0.1:8787',
      lastStdout: null,
      lastStderr: null,
    },
    bridge: {
      running: true,
      pid: 333,
      url: 'http://127.0.0.1:3005',
      lastStdout: null,
      lastStderr: null,
    },
    opencode: {
      running: true,
      pid: 444,
      url: 'http://127.0.0.1:4096',
      lastStdout: null,
      lastStderr: null,
    },
  },
};

const runtimeHealth: PilotRuntimeHealth = {
  ok: true,
  host: {
    ok: true,
    url: 'http://127.0.0.1:43110',
    error: null,
  },
  server: {
    ok: true,
    url: 'http://127.0.0.1:8787',
    error: null,
  },
  bridge: {
    ok: true,
    url: 'http://127.0.0.1:3005',
    error: null,
    snapshot: {
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
        feishu: false,
        discord: false,
        dingtalk: false,
        email: false,
        mochat: false,
        qq: false,
      },
      config: {
        groupsEnabled: false,
      },
    },
  },
};

describe('pilot runtime invoke wrappers', () => {
  beforeEach(() => {
    mockedInvoke.mockReset();
  });

  it('calls pilot_runtime_start with normalized nullable fields', async () => {
    mockedInvoke.mockResolvedValue(runtimeStatus);

    const result = await pilotRuntimeStart({
      workspacePath: '/tmp/ws',
      opencodeUrl: null,
      bridgeHealthPort: 3005,
    });

    expect(result).toEqual(runtimeStatus);
    expect(mockedInvoke).toHaveBeenCalledWith('pilot_runtime_start', {
      input: {
        workspacePath: '/tmp/ws',
        opencodeUrl: null,
        opencodeUsername: null,
        opencodePassword: null,
        bridgeHealthPort: 3005,
        pilotServerPort: null,
        hostDataDir: null,
      },
    });
  });

  it('calls pilot_runtime_stop', async () => {
    mockedInvoke.mockResolvedValue(runtimeStatus);

    await pilotRuntimeStop();

    expect(mockedInvoke).toHaveBeenCalledWith('pilot_runtime_stop');
  });

  it('calls pilot_runtime_status', async () => {
    mockedInvoke.mockResolvedValue(runtimeStatus);

    await pilotRuntimeStatus();

    expect(mockedInvoke).toHaveBeenCalledWith('pilot_runtime_status');
  });

  it('calls pilot_runtime_health', async () => {
    mockedInvoke.mockResolvedValue(runtimeHealth);

    const result = await pilotRuntimeHealth();

    expect(result).toEqual(runtimeHealth);
    expect(mockedInvoke).toHaveBeenCalledWith('pilot_runtime_health');
  });
});
