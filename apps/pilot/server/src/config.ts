/**
 * @license
 * Copyright 2026 cofy-x
 * SPDX-License-Identifier: Apache-2.0
 */

import { homedir } from 'node:os';
import { dirname, resolve } from 'node:path';
import type {
  ApprovalConfig,
  ApprovalMode,
  CliArgs,
  FileConfig,
  LogFormat,
  ServerConfig,
  WorkspaceConfig,
  WorkspaceInfo,
} from './types/index.js';
import { ApiError } from './errors.js';
import { buildWorkspaceInfos } from './services/workspace.service.js';
import {
  approvalModeSchema,
  cliArgsSchema,
  fileConfigSchema,
  resolvedWorkspaceConfigSchema,
} from './schemas/config.schema.js';
import { parseList, normalizeLogFormat, parseBoolean } from './utils/parse.js';
import { readJsonFileWithStatus } from './utils/fs.js';
import { shortId } from './utils/crypto.js';

const DEFAULT_PORT = 8787;
const DEFAULT_HOST = '127.0.0.1';
const DEFAULT_TIMEOUT_MS = 30000;
const DEFAULT_LOG_FORMAT: LogFormat = 'pretty';
const DEFAULT_LOG_REQUESTS = true;
const DEFAULT_MAX_BODY_BYTES = 1024 * 1024;

function formatSchemaIssues(issues: Array<{ path: PropertyKey[]; message: string }>) {
  return issues.map((issue) => ({
    path: issue.path.map((segment) => String(segment)).join('.'),
    message: issue.message,
  }));
}

function validateCliArgs(value: CliArgs): CliArgs {
  const parsed = cliArgsSchema.safeParse(value);
  if (parsed.success) return parsed.data;
  throw new ApiError(400, 'invalid_cli_args', 'Invalid CLI arguments', {
    issues: formatSchemaIssues(parsed.error.issues),
  });
}

export function parseCliArgs(argv: string[]): CliArgs {
  const args: CliArgs = { workspaces: [] };
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (!value) continue;
    if (value === '--help' || value === '-h') {
      args.help = true;
      continue;
    }
    if (value === '--version') {
      args.version = true;
      continue;
    }
    if (value === '--verbose') {
      args.verbose = true;
      continue;
    }
    if (value === '--log-format') {
      args.logFormat = normalizeLogFormat(argv[index + 1]);
      index += 1;
      continue;
    }
    if (value === '--log-requests') {
      args.logRequests = true;
      continue;
    }
    if (value === '--no-log-requests') {
      args.logRequests = false;
      continue;
    }
    if (value === '--config') {
      args.configPath = argv[index + 1];
      index += 1;
      continue;
    }
    if (value === '--host') {
      args.host = argv[index + 1];
      index += 1;
      continue;
    }
    if (value === '--port') {
      const port = Number(argv[index + 1]);
      if (!Number.isNaN(port)) args.port = port;
      index += 1;
      continue;
    }
    if (value === '--token') {
      args.token = argv[index + 1];
      index += 1;
      continue;
    }
    if (value === '--host-token') {
      args.hostToken = argv[index + 1];
      index += 1;
      continue;
    }
    if (value === '--approval') {
      const mode = argv[index + 1];
      if (mode === 'manual' || mode === 'auto') {
        args.approvalMode = mode;
      }
      index += 1;
      continue;
    }
    if (value === '--approval-timeout') {
      const timeout = Number(argv[index + 1]);
      if (!Number.isNaN(timeout)) args.approvalTimeoutMs = timeout;
      index += 1;
      continue;
    }
    if (value === '--opencode-url') {
      args.opencodeUrl = argv[index + 1];
      index += 1;
      continue;
    }
    if (value === '--opencode-directory') {
      args.opencodeDirectory = argv[index + 1];
      index += 1;
      continue;
    }
    if (value === '--opencode-username') {
      args.opencodeUsername = argv[index + 1];
      index += 1;
      continue;
    }
    if (value === '--opencode-password') {
      args.opencodePassword = argv[index + 1];
      index += 1;
      continue;
    }
    if (value === '--workspace') {
      const path = argv[index + 1];
      if (path) args.workspaces.push(path);
      index += 1;
      continue;
    }
    if (value === '--cors') {
      args.corsOrigins = parseList(argv[index + 1]);
      index += 1;
      continue;
    }
    if (value === '--read-only') {
      args.readOnly = true;
      continue;
    }
  }

  return validateCliArgs(args);
}

export function printHelp(): void {
  const message = [
    'pilot-server',
    '',
    'Options:',
    '  --config <path>          Path to server.json',
    '  --host <host>            Hostname (default 127.0.0.1)',
    '  --port <port>            Port (default 8787)',
    '  --token <token>          Client bearer token',
    '  --host-token <token>     Host approval token',
    '  --approval <mode>        manual | auto',
    '  --approval-timeout <ms>  Approval timeout',
    '  --opencode-url <url> OpenCode URL to share',
    '  --opencode-directory <path> OpenCode workspace directory to share',
    '  --opencode-username <user> OpenCode server username',
    '  --opencode-password <pass> OpenCode server password',
    '  --workspace <path>       Workspace root (repeatable)',
    '  --cors <origins>          Comma-separated origins or *',
    '  --read-only              Disable writes',
    '  --log-format <format>     Log output format: pretty | json',
    '  --log-requests           Log incoming requests (default: true)',
    '  --no-log-requests        Disable request logging',
    '  --verbose                Print resolved config',
    '  --version                Show version',
  ].join('\n');
  console.log(message);
}

async function loadFileConfig(configPath: string): Promise<FileConfig> {
  const parsed = await readJsonFileWithStatus<unknown>(configPath);
  if (parsed.status === 'missing') return {};
  if (parsed.status === 'invalid') {
    throw new ApiError(422, 'invalid_config', 'Invalid server config file', {
      path: configPath,
      error: parsed.error ?? 'invalid_json',
    });
  }
  const validated = fileConfigSchema.safeParse(parsed.data);
  if (validated.success) return validated.data;
  throw new ApiError(422, 'invalid_config', 'Invalid server config file', {
    path: configPath,
    issues: formatSchemaIssues(validated.error.issues),
  });
}

function parseEnvApprovalMode(warnings: string[]): ApprovalMode | undefined {
  const raw = process.env['PILOT_APPROVAL_MODE'];
  if (!raw) return undefined;
  const result = approvalModeSchema.safeParse(raw);
  if (!result.success) {
    warnings.push(
      `Ignoring invalid PILOT_APPROVAL_MODE=${JSON.stringify(raw)} (expected "manual" or "auto")`,
    );
    return undefined;
  }
  return result.data;
}

function parseMaxBodyBytes(value: number | undefined): number {
  if (value == null || !Number.isFinite(value)) return DEFAULT_MAX_BODY_BYTES;
  const parsed = Math.trunc(value);
  return parsed > 0 ? parsed : DEFAULT_MAX_BODY_BYTES;
}

function normalizeWorkspaceType(
  workspace: WorkspaceConfig,
): WorkspaceConfig & { workspaceType: 'local' | 'remote' } {
  return {
    ...workspace,
    workspaceType: workspace.workspaceType ?? 'local',
  };
}

function validateResolvedWorkspaceConfigs(
  workspaces: WorkspaceConfig[],
): WorkspaceConfig[] {
  const validated: WorkspaceConfig[] = [];
  for (let index = 0; index < workspaces.length; index += 1) {
    const workspace = normalizeWorkspaceType(workspaces[index] ?? { path: '' });
    const parsed = resolvedWorkspaceConfigSchema.safeParse(workspace);
    if (!parsed.success) {
      throw new ApiError(422, 'invalid_workspace_config', 'Invalid workspace config', {
        workspaceIndex: index,
        issues: formatSchemaIssues(parsed.error.issues).map((issue) => ({
          ...issue,
          path: issue.path
            ? `workspaces.${index}.${issue.path}`
            : `workspaces.${index}`,
        })),
      });
    }
    validated.push(parsed.data);
  }
  return validated;
}

function ensureUniqueWorkspaceIds(workspaces: WorkspaceInfo[]): void {
  const seen = new Map<string, number>();
  for (let index = 0; index < workspaces.length; index += 1) {
    const id = workspaces[index]?.id;
    if (!id) continue;
    const first = seen.get(id);
    if (first !== undefined) {
      throw new ApiError(
        422,
        'duplicate_workspace_id',
        `Duplicate workspace id: ${id}`,
        {
          id,
          firstIndex: first,
          duplicateIndex: index,
        },
      );
    }
    seen.set(id, index);
  }
}

function parseEnvInteger(
  name: string,
  warnings: string[],
  min = 1,
  max = Number.MAX_SAFE_INTEGER,
): number | undefined {
  const raw = process.env[name];
  if (raw == null) return undefined;
  const value = Number(raw);
  if (
    !Number.isFinite(value) ||
    !Number.isInteger(value) ||
    value < min ||
    value > max
  ) {
    warnings.push(
      `Ignoring invalid ${name}=${JSON.stringify(raw)} (expected integer in [${min}, ${max}])`,
    );
    return undefined;
  }
  return value;
}

function parseWorkspaceEnv(): string[] {
  const workspaceList = parseList(process.env['PILOT_WORKSPACES']);
  if (workspaceList.length > 0) {
    return workspaceList;
  }
  return parseList(process.env['PILOT_WORKSPACE']);
}

export async function resolveServerConfig(cli: CliArgs): Promise<ServerConfig> {
  const parsedCli = validateCliArgs(cli);
  const envConfigPath = process.env['PILOT_SERVER_CONFIG'];
  const configPath =
    parsedCli.configPath ??
    envConfigPath ??
    resolve(homedir(), '.config', 'pilot', 'server.json');
  const fileConfig = await loadFileConfig(configPath);
  const warnings: string[] = [];
  const configDir = dirname(configPath);

  const envWorkspaces = parseWorkspaceEnv();
  let workspaceConfigs: WorkspaceConfig[] =
    parsedCli.workspaces.length > 0
      ? parsedCli.workspaces.map((path) => ({ path }))
      : envWorkspaces.length > 0
        ? envWorkspaces.map((path) => ({ path }))
        : (fileConfig.workspaces ?? []);

  const envOpencodeUrl = process.env['PILOT_OPENCODE_URL'];
  const envOpencodeDirectory = process.env['PILOT_OPENCODE_DIRECTORY'];
  const envOpencodeUsername = process.env['PILOT_OPENCODE_USERNAME'];
  const envOpencodePassword = process.env['PILOT_OPENCODE_PASSWORD'];
  const opencodeUrl = parsedCli.opencodeUrl ?? envOpencodeUrl;
  const opencodeDirectory = parsedCli.opencodeDirectory ?? envOpencodeDirectory;
  const opencodeUsername =
    parsedCli.opencodeUsername ?? envOpencodeUsername ?? fileConfig.opencodeUsername;
  const opencodePassword =
    parsedCli.opencodePassword ?? envOpencodePassword ?? fileConfig.opencodePassword;

  if (
    workspaceConfigs.length > 0 &&
    (opencodeUrl ||
      opencodeDirectory ||
      opencodeUsername ||
      opencodePassword)
  ) {
    const allowDirectoryOverride =
      workspaceConfigs.length === 1 && Boolean(opencodeDirectory);
    workspaceConfigs = workspaceConfigs.map((workspace, index) => {
      const nextDirectory =
        workspace.directory ??
        (allowDirectoryOverride && index === 0 ? opencodeDirectory : undefined);
      return {
        ...workspace,
        baseUrl: workspace.baseUrl ?? opencodeUrl,
        directory: nextDirectory,
        opencodeUsername: workspace.opencodeUsername ?? opencodeUsername,
        opencodePassword: workspace.opencodePassword ?? opencodePassword,
      };
    });
  }

  workspaceConfigs = validateResolvedWorkspaceConfigs(workspaceConfigs);
  const workspaces = buildWorkspaceInfos(workspaceConfigs, configDir);
  ensureUniqueWorkspaceIds(workspaces);

  const tokenFromEnv = process.env['PILOT_TOKEN'];
  const hostTokenFromEnv = process.env['PILOT_HOST_TOKEN'];

  const token = parsedCli.token ?? tokenFromEnv ?? fileConfig.token ?? shortId();
  const hostToken =
    parsedCli.hostToken ?? hostTokenFromEnv ?? fileConfig.hostToken ?? shortId();

  const tokenSource: ServerConfig['tokenSource'] = parsedCli.token
    ? 'cli'
    : tokenFromEnv
      ? 'env'
      : fileConfig.token
        ? 'file'
        : 'generated';

  const hostTokenSource: ServerConfig['hostTokenSource'] = parsedCli.hostToken
    ? 'cli'
    : hostTokenFromEnv
      ? 'env'
      : fileConfig.hostToken
        ? 'file'
        : 'generated';

  const approvalMode =
    parsedCli.approvalMode ??
    parseEnvApprovalMode(warnings) ??
    fileConfig.approval?.mode ??
    'manual';

  const approvalTimeoutMs =
    parsedCli.approvalTimeoutMs ??
    parseEnvInteger(
      'PILOT_APPROVAL_TIMEOUT_MS',
      warnings,
      1,
      Number.MAX_SAFE_INTEGER,
    ) ??
    fileConfig.approval?.timeoutMs ??
    DEFAULT_TIMEOUT_MS;

  const approval: ApprovalConfig = {
    mode: approvalMode === 'auto' ? 'auto' : 'manual',
    timeoutMs: Number.isNaN(approvalTimeoutMs)
      ? DEFAULT_TIMEOUT_MS
      : approvalTimeoutMs,
  };

  const envCorsOrigins = process.env['PILOT_CORS_ORIGINS'];
  const parsedEnvCors = envCorsOrigins ? parseList(envCorsOrigins) : null;
  const corsOrigins =
    parsedCli.corsOrigins ?? parsedEnvCors ?? fileConfig.corsOrigins ?? ['*'];

  const envReadOnly = parseBoolean(process.env['PILOT_READONLY']);
  const readOnly = parsedCli.readOnly ?? envReadOnly ?? fileConfig.readOnly ?? false;

  const envLogFormat = process.env['PILOT_LOG_FORMAT'];
  const logFormat =
    parsedCli.logFormat ??
    normalizeLogFormat(envLogFormat) ??
    normalizeLogFormat(fileConfig.logFormat) ??
    DEFAULT_LOG_FORMAT;

  const envLogRequests = parseBoolean(process.env['PILOT_LOG_REQUESTS']);
  const logRequests =
    parsedCli.logRequests ??
    envLogRequests ??
    fileConfig.logRequests ??
    DEFAULT_LOG_REQUESTS;

  const authorizedRoots = fileConfig.authorizedRoots?.length
    ? fileConfig.authorizedRoots.map((root) => resolve(configDir, root))
    : workspaces.map((workspace) => workspace.path);

  const host =
    parsedCli.host ?? process.env['PILOT_HOST'] ?? fileConfig.host ?? DEFAULT_HOST;
  const port =
    parsedCli.port ??
    parseEnvInteger('PILOT_PORT', warnings, 1, 65535) ??
    fileConfig.port ??
    DEFAULT_PORT;

  const maxBodyBytesCandidate =
    parseEnvInteger(
      'PILOT_MAX_BODY_BYTES',
      warnings,
      1,
      Number.MAX_SAFE_INTEGER,
    ) ?? fileConfig.maxBodyBytes;
  const maxBodyBytes = parseMaxBodyBytes(maxBodyBytesCandidate);

  return {
    host,
    port: Number.isNaN(port) ? DEFAULT_PORT : port,
    maxBodyBytes,
    token,
    hostToken,
    configPath,
    approval,
    corsOrigins,
    workspaces,
    authorizedRoots,
    readOnly,
    startedAt: Date.now(),
    tokenSource,
    hostTokenSource,
    logFormat,
    logRequests,
    warnings,
  };
}
