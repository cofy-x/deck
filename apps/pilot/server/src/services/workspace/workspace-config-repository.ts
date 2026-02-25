/**
 * @license
 * Copyright 2026 cofy-x
 * SPDX-License-Identifier: Apache-2.0
 */

import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { JsonObject } from '../../types/index.js';
import { ApiError } from '../../errors.js';
import { readJsoncFile } from '../../utils/jsonc.js';
import { pilotConfigPath, opencodeConfigPath } from '../../utils/workspace-files.js';
import { ensureDir, exists } from '../../utils/fs.js';

export async function readOpencodeConfig(
  workspaceRoot: string,
): Promise<JsonObject> {
  const { data } = await readJsoncFile(
    opencodeConfigPath(workspaceRoot),
    {} as JsonObject,
  );
  return data;
}

export async function readPilotConfig(
  workspaceRoot: string,
): Promise<JsonObject> {
  const path = pilotConfigPath(workspaceRoot);
  if (!(await exists(path))) return {};
  try {
    const raw = await readFile(path, 'utf8');
    return JSON.parse(raw) as JsonObject;
  } catch {
    throw new ApiError(422, 'invalid_json', 'Failed to parse pilot.json');
  }
}

export async function writePilotConfig(
  workspaceRoot: string,
  payload: JsonObject,
  merge: boolean,
): Promise<void> {
  const path = pilotConfigPath(workspaceRoot);
  const next = merge
    ? { ...(await readPilotConfig(workspaceRoot)), ...payload }
    : payload;
  await ensureDir(join(workspaceRoot, '.opencode'));
  await writeFile(path, JSON.stringify(next, null, 2) + '\n', 'utf8');
}
