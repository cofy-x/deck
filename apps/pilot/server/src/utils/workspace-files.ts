/**
 * @license
 * Copyright 2026 cofy-x
 * SPDX-License-Identifier: Apache-2.0
 */

import { existsSync } from 'node:fs';
import { join } from 'node:path';

export function opencodeConfigPath(workspaceRoot: string): string {
  const jsoncPath = join(workspaceRoot, 'opencode.jsonc');
  const jsonPath = join(workspaceRoot, 'opencode.json');
  if (existsSync(jsoncPath)) return jsoncPath;
  if (existsSync(jsonPath)) return jsonPath;
  return jsoncPath;
}

export function pilotConfigPath(workspaceRoot: string): string {
  return join(workspaceRoot, '.opencode', 'pilot.json');
}

export function projectSkillsDir(workspaceRoot: string): string {
  return join(workspaceRoot, '.opencode', 'skills');
}

export function projectCommandsDir(workspaceRoot: string): string {
  return join(workspaceRoot, '.opencode', 'commands');
}

export function projectPluginsDir(workspaceRoot: string): string {
  return join(workspaceRoot, '.opencode', 'plugins');
}
