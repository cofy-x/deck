/**
 * @license
 * Copyright 2026 cofy-x
 * SPDX-License-Identifier: Apache-2.0
 */

import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import { afterEach, describe, expect, test, vi } from 'vitest';

import {
  loadRouterState,
  routerStatePath,
  saveRouterState,
} from './router/state-store.js';
import type { RouterState } from './types/index.js';

const tempDirs: string[] = [];

async function createTempDir(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), 'pilot-host-state-store-'));
  tempDirs.push(dir);
  return dir;
}

describe('router state store', () => {
  afterEach(async () => {
    await Promise.all(
      tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })),
    );
  });

  test('falls back to defaults when state file is invalid and emits warning', async () => {
    const dataDir = await createTempDir();
    const statePath = routerStatePath(dataDir);
    await writeFile(statePath, '{"version":', 'utf8');
    const warning = vi.fn();

    const state = await loadRouterState(statePath, {
      onWarning: warning,
    });

    expect(state.version).toBe(1);
    expect(state.activeId).toBe('');
    expect(state.workspaces).toEqual([]);
    expect(warning).toHaveBeenCalledTimes(1);
    expect(String(warning.mock.calls[0]?.[0])).toContain(
      'Failed to parse router state JSON',
    );
  });

  test('serializes concurrent writes and leaves a valid json document', async () => {
    const dataDir = await createTempDir();
    const statePath = routerStatePath(dataDir);
    const base: RouterState = {
      version: 1,
      activeId: '',
      workspaces: [],
    };

    const writes = Array.from({ length: 20 }, (_value, index) =>
      saveRouterState(statePath, {
        ...base,
        activeId: `ws-${index}`,
      }),
    );
    await Promise.all(writes);

    const raw = await readFile(statePath, 'utf8');
    const parsed = JSON.parse(raw) as RouterState;
    expect(parsed.activeId).toBe('ws-19');
    expect(Array.isArray(parsed.workspaces)).toBe(true);
  });
});
