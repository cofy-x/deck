/**
 * @license
 * Copyright 2026 cofy-x
 * SPDX-License-Identifier: Apache-2.0
 */

import { randomUUID } from 'node:crypto';

import {
  parseList,
  readApprovalMode,
  readBool,
  readFlag,
  readPort,
  readTimeoutMs,
} from '../args.js';
import { readVersionManifest, resolveSidecarConfig } from '../binary.js';
import { resolveRuntimeConfig } from '../runtime-config.js';
import type {
  ApprovalMode,
  BinarySourcePreference,
  LogFormat,
  Logger,
  ParsedArgs,
  SidecarConfig,
  VersionManifest,
} from '../types/index.js';
import { ensureWorkspace } from '../utils/fs.js';
import { buildAttachCommand } from '../utils/help.js';
import { resolveConnectUrl, resolvePort } from '../utils/network.js';
import {
  DEFAULT_APPROVAL_TIMEOUT,
  DEFAULT_BRIDGE_HEALTH_PORT,
  DEFAULT_OPENCODE_USERNAME,
  DEFAULT_PILOT_PORT,
} from '../utils/process.js';

export interface StartConfig {
  outputJson: boolean;
  checkOnly: boolean;
  checkEvents: boolean;
  verbose: boolean;
  logFormat: LogFormat;
  detachRequested: boolean;
  colorEnabled: boolean;
  runId: string;
  cliVersion: string;
  logger: Logger;
  logVerbose: (message: string) => void;
  sidecarSource: BinarySourcePreference;
  opencodeSource: BinarySourcePreference;
  workspace: string;
  resolvedWorkspace: string;
  explicitOpencodeBin?: string;
  explicitPilotServerBin?: string;
  explicitBridgeBin?: string;
  opencodeManagedByHost: boolean;
  pilotManagedByHost: boolean;
  bridgeManagedByHost: boolean;
  externalPilotUrl?: string;
  externalBridgeUrl?: string;
  opencodeBindHost: string;
  opencodePort: number;
  opencodeUsername?: string;
  opencodePassword?: string;
  pilotHost: string;
  pilotPort: number;
  bridgeHealthPort: number;
  pilotToken: string;
  pilotHostToken: string;
  approvalMode: ApprovalMode;
  approvalTimeoutMs: number;
  readOnly: boolean;
  corsOrigins: string[];
  connectHost?: string;
  sidecar: SidecarConfig;
  manifest: VersionManifest | null;
  allowExternal: boolean;
  bridgeEnabled: boolean;
  bridgeRequired: boolean;
  opencodeBaseUrl: string;
  opencodeConnectUrl: string;
  pilotBaseUrl: string;
  pilotConnectUrl: string;
  attachCommand: string;
  bridgeHealthUrl: string;
}

interface ParsedExternalServiceUrl {
  baseUrl: string;
  host: string;
  port: number;
}

function parseExternalServiceUrl(
  raw: string,
  optionName: '--opencode-url' | '--pilot-url' | '--bridge-url',
): ParsedExternalServiceUrl {
  const value = raw.trim();
  if (!value) {
    throw new Error(`Invalid ${optionName} value: empty string.`);
  }
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error(`Invalid ${optionName} value: ${value}`);
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error(
      `Invalid ${optionName} protocol: ${parsed.protocol}. Use http or https.`,
    );
  }
  const port = parsed.port
    ? Number(parsed.port)
    : parsed.protocol === 'https:'
      ? 443
      : 80;
  if (!Number.isInteger(port) || port < 1 || port > 65_535) {
    throw new Error(`Invalid ${optionName} port: ${parsed.port || '<none>'}.`);
  }
  const baseUrl = parsed.toString().replace(/\/$/, '');
  return {
    baseUrl,
    host: parsed.hostname,
    port,
  };
}

export async function resolveStartConfig(args: ParsedArgs): Promise<StartConfig> {
  const runtime = await resolveRuntimeConfig(args, {
    serviceName: 'pilot',
    verboseComponent: 'pilot',
    defaultLogFormat: 'pretty',
  });
  const {
    outputJson,
    verbose,
    logFormat,
    colorEnabled,
    runId,
    cliVersion,
    logger,
    logVerbose,
    sidecarSource,
    opencodeSource,
    allowExternal,
  } = runtime;
  const checkOnly = readBool(args.flags, 'check', false);
  const checkEvents = readBool(args.flags, 'check-events', false);
  const detachRequested = readBool(args.flags, 'detach', false, 'PILOT_DETACH');

  const workspace =
    readFlag(args.flags, 'workspace') ??
    process.env['PILOT_WORKSPACE'] ??
    process.cwd();
  const resolvedWorkspace = await ensureWorkspace(workspace);

  const explicitOpencodeBin =
    readFlag(args.flags, 'opencode-bin') ?? process.env['PILOT_OPENCODE_BIN'];
  const explicitPilotServerBin =
    readFlag(args.flags, 'pilot-server-bin') ?? process.env['PILOT_SERVER_BIN'];
  const explicitBridgeBin =
    readFlag(args.flags, 'bridge-bin') ?? process.env['BRIDGE_BIN'];
  const externalOpencodeUrlValue =
    readFlag(args.flags, 'opencode-url') ??
    process.env['PILOT_OPENCODE_URL'] ??
    '';
  const externalPilotUrlValue =
    readFlag(args.flags, 'pilot-url') ?? process.env['PILOT_URL'] ?? '';
  const externalBridgeUrlValue =
    readFlag(args.flags, 'bridge-url') ?? process.env['PILOT_BRIDGE_URL'] ?? '';

  const opencodeAuth = readBool(
    args.flags,
    'opencode-auth',
    true,
    'PILOT_OPENCODE_AUTH',
  );
  const opencodeUsername = opencodeAuth
    ? (readFlag(args.flags, 'opencode-username') ??
      process.env['PILOT_OPENCODE_USERNAME'] ??
      DEFAULT_OPENCODE_USERNAME)
    : undefined;
  const opencodePassword = opencodeAuth
    ? (readFlag(args.flags, 'opencode-password') ??
      process.env['PILOT_OPENCODE_PASSWORD'] ??
      randomUUID())
    : undefined;

  const opencodeManagedByHost = externalOpencodeUrlValue.trim().length === 0;
  const pilotManagedByHost = externalPilotUrlValue.trim().length === 0;
  const bridgeEnabled = readBool(args.flags, 'bridge', true);
  const bridgeManagedByHost =
    bridgeEnabled && externalBridgeUrlValue.trim().length === 0;

  if (
    !opencodeManagedByHost &&
    (args.flags.has('opencode-host') || args.flags.has('opencode-port'))
  ) {
    throw new Error(
      '--opencode-url cannot be used with --opencode-host or --opencode-port.',
    );
  }
  if (
    !pilotManagedByHost &&
    (args.flags.has('pilot-host') ||
      args.flags.has('pilot-port') ||
      args.flags.has('pilot-server-bin'))
  ) {
    throw new Error(
      '--pilot-url cannot be used with --pilot-host, --pilot-port, or --pilot-server-bin.',
    );
  }
  if (
    !bridgeManagedByHost &&
    (args.flags.has('bridge-bin') || args.flags.has('bridge-health-port'))
  ) {
    throw new Error(
      '--bridge-url cannot be used with --bridge-bin or --bridge-health-port.',
    );
  }
  if (!bridgeManagedByHost && args.flags.has('bridge') && !bridgeEnabled) {
    throw new Error('--bridge-url cannot be used with --no-bridge.');
  }

  let opencodeBindHost =
    readFlag(args.flags, 'opencode-host') ??
    process.env['PILOT_OPENCODE_BIND_HOST'] ??
    '0.0.0.0';
  let opencodePort = 0;

  let pilotHost =
    readFlag(args.flags, 'pilot-host') ??
    process.env['PILOT_HOST'] ??
    '0.0.0.0';
  let pilotPort = 0;
  let bridgeHealthPort = await resolvePort(
    readPort(args.flags, 'bridge-health-port', undefined, 'BRIDGE_HEALTH_PORT'),
    '127.0.0.1',
    DEFAULT_BRIDGE_HEALTH_PORT,
  );
  const pilotTokenValue =
    readFlag(args.flags, 'pilot-token') ?? process.env['PILOT_TOKEN'];
  const pilotHostTokenValue =
    readFlag(args.flags, 'pilot-host-token') ?? process.env['PILOT_HOST_TOKEN'];
  if (!pilotManagedByHost && (!pilotTokenValue || !pilotHostTokenValue)) {
    throw new Error(
      'External --pilot-url requires --pilot-token and --pilot-host-token (or PILOT_TOKEN and PILOT_HOST_TOKEN).',
    );
  }
  const pilotToken = pilotTokenValue ?? randomUUID();
  const pilotHostToken = pilotHostTokenValue ?? randomUUID();
  const approvalMode = readApprovalMode(
    args.flags,
    'approval',
    'manual',
    'PILOT_APPROVAL_MODE',
  );
  const approvalTimeoutMs = readTimeoutMs(
    args.flags,
    'approval-timeout',
    DEFAULT_APPROVAL_TIMEOUT,
    'PILOT_APPROVAL_TIMEOUT_MS',
  ) as number;
  const readOnly = readBool(args.flags, 'read-only', false, 'PILOT_READONLY');
  const corsValue =
    readFlag(args.flags, 'cors') ?? process.env['PILOT_CORS_ORIGINS'] ?? '*';
  const corsOrigins = parseList(corsValue);
  const connectHost = readFlag(args.flags, 'connect-host');
  const bridgeRequired = readBool(
    args.flags,
    'bridge-required',
    false,
    'PILOT_BRIDGE_REQUIRED',
  );

  const sidecar = resolveSidecarConfig(args.flags, cliVersion);
  const manifest = await readVersionManifest();

  let opencodeBaseUrl = '';
  let opencodeConnectUrl = '';
  if (opencodeManagedByHost) {
    opencodePort = await resolvePort(
      readPort(args.flags, 'opencode-port', undefined, 'PILOT_OPENCODE_PORT'),
      opencodeBindHost,
    );
    opencodeBaseUrl = `http://127.0.0.1:${opencodePort}`;
    const opencodeConnect = resolveConnectUrl(opencodePort, connectHost);
    opencodeConnectUrl = opencodeConnect.connectUrl ?? opencodeBaseUrl;
  } else {
    const parsedExternal = parseExternalServiceUrl(
      externalOpencodeUrlValue,
      '--opencode-url',
    );
    opencodeBaseUrl = parsedExternal.baseUrl;
    opencodeConnectUrl = parsedExternal.baseUrl;
    opencodeBindHost = parsedExternal.host;
    opencodePort = parsedExternal.port;
  }

  let pilotBaseUrl = '';
  let pilotConnectUrl = '';
  if (pilotManagedByHost) {
    pilotPort = await resolvePort(
      readPort(args.flags, 'pilot-port', undefined, 'PILOT_PORT'),
      pilotHost,
      DEFAULT_PILOT_PORT,
    );
    pilotBaseUrl = `http://127.0.0.1:${pilotPort}`;
    const pilotConnect = resolveConnectUrl(pilotPort, connectHost);
    pilotConnectUrl = pilotConnect.connectUrl ?? pilotBaseUrl;
  } else {
    const parsedExternalPilot = parseExternalServiceUrl(
      externalPilotUrlValue,
      '--pilot-url',
    );
    pilotBaseUrl = parsedExternalPilot.baseUrl;
    pilotConnectUrl = parsedExternalPilot.baseUrl;
    pilotHost = parsedExternalPilot.host;
    pilotPort = parsedExternalPilot.port;
  }

  const attachCommand = buildAttachCommand({
    url: opencodeConnectUrl,
    workspace: resolvedWorkspace,
    username: opencodeUsername,
    password: opencodePassword,
  });

  let bridgeHealthUrl = `http://127.0.0.1:${bridgeHealthPort}`;
  if (bridgeEnabled && !bridgeManagedByHost) {
    const parsedExternalBridge = parseExternalServiceUrl(
      externalBridgeUrlValue,
      '--bridge-url',
    );
    bridgeHealthUrl = parsedExternalBridge.baseUrl;
    bridgeHealthPort = parsedExternalBridge.port;
  }

  return {
    outputJson,
    checkOnly,
    checkEvents,
    verbose,
    logFormat,
    detachRequested,
    colorEnabled,
    runId,
    cliVersion,
    logger,
    logVerbose,
    sidecarSource,
    opencodeSource,
    workspace,
    resolvedWorkspace,
    explicitOpencodeBin,
    explicitPilotServerBin,
    explicitBridgeBin,
    opencodeManagedByHost,
    pilotManagedByHost,
    bridgeManagedByHost,
    externalPilotUrl: pilotManagedByHost ? undefined : pilotBaseUrl,
    externalBridgeUrl:
      bridgeEnabled && !bridgeManagedByHost ? bridgeHealthUrl : undefined,
    opencodeBindHost,
    opencodePort,
    opencodeUsername,
    opencodePassword,
    pilotHost,
    pilotPort,
    bridgeHealthPort,
    pilotToken,
    pilotHostToken,
    approvalMode,
    approvalTimeoutMs,
    readOnly,
    corsOrigins,
    connectHost,
    sidecar,
    manifest,
    allowExternal,
    bridgeEnabled,
    bridgeRequired,
    opencodeBaseUrl,
    opencodeConnectUrl,
    pilotBaseUrl,
    pilotConnectUrl,
    attachCommand,
    bridgeHealthUrl,
  };
}
