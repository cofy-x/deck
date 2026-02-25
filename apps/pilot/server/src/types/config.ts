/**
 * @license
 * Copyright 2026 cofy-x
 * SPDX-License-Identifier: Apache-2.0
 */

export type WorkspaceType = 'local' | 'remote';

export type ApprovalMode = 'manual' | 'auto';

export type LogFormat = 'pretty' | 'json';

export type TokenSource = 'cli' | 'env' | 'file' | 'generated';

export interface WorkspaceIdentity {
  id: string;
  name: string;
  path: string;
  workspaceType: WorkspaceType;
}

export interface WorkspaceConfig {
  id?: string;
  path: string;
  name?: string;
  workspaceType?: WorkspaceType;
  baseUrl?: string;
  directory?: string;
  opencodeUsername?: string;
  opencodePassword?: string;
}

export interface WorkspaceInfo extends WorkspaceIdentity {
  baseUrl?: string;
  directory?: string;
  opencodeUsername?: string;
  opencodePassword?: string;
}

export interface WorkspaceOpencodeView {
  baseUrl?: string;
  directory?: string;
  username?: string;
  password?: string;
}

export interface SerializedWorkspace extends WorkspaceIdentity {
  opencode?: WorkspaceOpencodeView;
}

export interface ApprovalConfig {
  mode: ApprovalMode;
  timeoutMs: number;
}

export interface ServerConfig {
  host: string;
  port: number;
  maxBodyBytes: number;
  token: string;
  hostToken: string;
  configPath?: string;
  approval: ApprovalConfig;
  corsOrigins: string[];
  workspaces: WorkspaceInfo[];
  authorizedRoots: string[];
  readOnly: boolean;
  startedAt: number;
  tokenSource: TokenSource;
  hostTokenSource: TokenSource;
  logFormat: LogFormat;
  logRequests: boolean;
  warnings: string[];
}

export interface Capabilities {
  skills: { read: boolean; write: boolean; source: 'pilot' | 'opencode' };
  plugins: { read: boolean; write: boolean };
  mcp: { read: boolean; write: boolean };
  commands: { read: boolean; write: boolean };
  config: { read: boolean; write: boolean };
}

export interface CliArgs {
  configPath?: string;
  host?: string;
  port?: number;
  token?: string;
  hostToken?: string;
  approvalMode?: ApprovalMode;
  approvalTimeoutMs?: number;
  opencodeUrl?: string;
  opencodeDirectory?: string;
  opencodeUsername?: string;
  opencodePassword?: string;
  workspaces: string[];
  corsOrigins?: string[];
  readOnly?: boolean;
  verbose?: boolean;
  logFormat?: LogFormat;
  logRequests?: boolean;
  version?: boolean;
  help?: boolean;
}

export interface FileConfig {
  host?: string;
  port?: number;
  token?: string;
  hostToken?: string;
  approval?: Partial<ApprovalConfig>;
  workspaces?: WorkspaceConfig[];
  corsOrigins?: string[];
  authorizedRoots?: string[];
  readOnly?: boolean;
  opencodeUsername?: string;
  opencodePassword?: string;
  logFormat?: LogFormat;
  logRequests?: boolean;
  maxBodyBytes?: number;
}
