/**
 * @license
 * Copyright 2026 cofy-x
 * SPDX-License-Identifier: Apache-2.0
 */

import type { JsonObject } from './json.js';

export interface Actor {
  type: 'remote' | 'host';
  clientId?: string;
  tokenHash?: string;
}

export type AuthMode = 'none' | 'client' | 'host';

export interface ApprovalRequest {
  id: string;
  workspaceId: string;
  action: string;
  summary: string;
  paths: string[];
  createdAt: number;
  actor: Actor;
}

export interface ApprovalResult {
  id: string;
  allowed: boolean;
  reason?: string;
}

export interface ApiErrorBody {
  code: string;
  message: string;
  details?: JsonObject;
}

export interface AuditEntry {
  id: string;
  workspaceId: string;
  actor: Actor;
  action: string;
  target: string;
  summary: string;
  timestamp: number;
}

export interface PluginItem {
  spec: string;
  source: 'config' | 'dir.project' | 'dir.global';
  scope: 'project' | 'global';
  path?: string;
}

export interface McpItem {
  name: string;
  config: JsonObject;
  source: 'config.project' | 'config.global' | 'config.remote';
  disabledByTools?: boolean;
}

export interface SkillItem {
  name: string;
  path: string;
  description: string;
  scope: 'project' | 'global';
  trigger?: string;
}

export interface CommandItem {
  name: string;
  description?: string;
  template: string;
  agent?: string;
  model?: string | null;
  subtask?: boolean;
  scope: 'workspace' | 'global';
}

export type ReloadReason =
  | 'plugins'
  | 'skills'
  | 'mcp'
  | 'config'
  | 'agents'
  | 'commands';

export type ReloadTrigger = {
  type: 'skill' | 'plugin' | 'config' | 'mcp' | 'agent' | 'command';
  name?: string;
  action?: 'added' | 'removed' | 'updated';
  path?: string;
};

export interface ReloadEvent {
  id: string;
  seq: number;
  workspaceId: string;
  reason: ReloadReason;
  trigger?: ReloadTrigger;
  timestamp: number;
}
