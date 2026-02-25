/**
 * @license
 * Copyright 2026 cofy-x
 * SPDX-License-Identifier: Apache-2.0
 */

import { minimatch } from 'minimatch';
import type { JsonObject, McpItem } from '../types/index.js';
import { readJsoncFile, updateJsoncTopLevel } from '../utils/jsonc.js';
import { opencodeConfigPath } from '../utils/workspace-files.js';
import { validateMcpConfig, validateMcpName } from '../utils/validators.js';

function getMcpConfig(config: JsonObject): Record<string, JsonObject> {
  const mcp = config['mcp'];
  if (!mcp || typeof mcp !== 'object') return {};
  return mcp as Record<string, JsonObject>;
}

function getDeniedToolPatterns(config: JsonObject): string[] {
  const tools = config['tools'];
  if (!tools || typeof tools !== 'object') return [];
  const deny = (tools as { deny?: string[] }).deny;
  if (!Array.isArray(deny)) return [];
  return deny.filter((item): item is string => typeof item === 'string');
}

function isMcpDisabledByTools(config: JsonObject, name: string): boolean {
  const patterns = getDeniedToolPatterns(config);
  if (patterns.length === 0) return false;
  const candidates = [
    `mcp.${name}`,
    `mcp.${name}.*`,
    `mcp:${name}`,
    `mcp:${name}:*`,
    'mcp.*',
    'mcp:*',
  ];
  return patterns.some((pattern) =>
    candidates.some((candidate) => minimatch(candidate, pattern)),
  );
}

export async function listMcp(workspaceRoot: string): Promise<McpItem[]> {
  const { data: config } = await readJsoncFile(
    opencodeConfigPath(workspaceRoot),
    {} as JsonObject,
  );
  const mcpMap = getMcpConfig(config);
  return Object.entries(mcpMap).map(([name, entry]) => ({
    name,
    config: entry,
    source: 'config.project',
    disabledByTools: isMcpDisabledByTools(config, name) || undefined,
  }));
}

export async function addMcp(
  workspaceRoot: string,
  name: string,
  config: JsonObject,
): Promise<{ action: 'added' | 'updated' }> {
  validateMcpName(name);
  validateMcpConfig(config);
  const { data } = await readJsoncFile(
    opencodeConfigPath(workspaceRoot),
    {} as JsonObject,
  );
  const mcpMap = getMcpConfig(data);
  const existed = Object.prototype.hasOwnProperty.call(mcpMap, name);
  mcpMap[name] = config;
  await updateJsoncTopLevel(opencodeConfigPath(workspaceRoot), { mcp: mcpMap });
  return { action: existed ? 'updated' : 'added' };
}

export async function removeMcp(
  workspaceRoot: string,
  name: string,
): Promise<boolean> {
  const { data } = await readJsoncFile(
    opencodeConfigPath(workspaceRoot),
    {} as JsonObject,
  );
  const mcpMap = getMcpConfig(data);
  if (!Object.prototype.hasOwnProperty.call(mcpMap, name)) return false;
  delete mcpMap[name];
  await updateJsoncTopLevel(opencodeConfigPath(workspaceRoot), { mcp: mcpMap });
  return true;
}
