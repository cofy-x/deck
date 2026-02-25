/**
 * @license
 * Copyright 2026 cofy-x
 * SPDX-License-Identifier: Apache-2.0
 */

import { randomUUID } from 'node:crypto';

import {
  readBinarySource,
  readBool,
  readFlag,
  readLogFormat,
} from './args.js';
import { createLogger, createVerboseLogger } from './logger.js';
import type {
  BinarySourcePreference,
  LogFormat,
  Logger,
  ParsedArgs,
} from './types/index.js';
import { resolveCliVersion } from './utils/fs.js';

export interface RuntimeConfig {
  outputJson: boolean;
  verbose: boolean;
  logFormat: LogFormat;
  colorEnabled: boolean;
  runId: string;
  cliVersion: string;
  logger: Logger;
  logVerbose: (message: string) => void;
  sidecarSource: BinarySourcePreference;
  opencodeSource: BinarySourcePreference;
  allowExternal: boolean;
}

interface ResolveRuntimeConfigOptions {
  serviceName?: string;
  verboseComponent?: string;
  defaultLogFormat?: LogFormat;
}

export async function resolveRuntimeConfig(
  args: ParsedArgs,
  options?: ResolveRuntimeConfigOptions,
): Promise<RuntimeConfig> {
  const outputJson = readBool(args.flags, 'json', false);
  const verbose = readBool(args.flags, 'verbose', false, 'PILOT_VERBOSE');
  const logFormat = readLogFormat(
    args.flags,
    'log-format',
    options?.defaultLogFormat ?? 'pretty',
    'PILOT_LOG_FORMAT',
  );
  const colorEnabled =
    readBool(args.flags, 'color', !!process.stdout.isTTY, 'PILOT_COLOR') &&
    !process.env['NO_COLOR'];
  const runId =
    readFlag(args.flags, 'run-id') ??
    process.env['PILOT_RUN_ID'] ??
    randomUUID();
  const cliVersion = await resolveCliVersion();
  const serviceName = options?.serviceName ?? 'pilot';
  const logger = createLogger({
    format: logFormat,
    runId,
    serviceName,
    serviceVersion: cliVersion,
    output: outputJson ? 'silent' : 'stdout',
    color: colorEnabled,
  });
  const logVerbose = createVerboseLogger(
    verbose && !outputJson,
    logger,
    options?.verboseComponent ?? serviceName,
  );
  const sidecarSource = readBinarySource(
    args.flags,
    'sidecar-source',
    'auto',
    'PILOT_SIDECAR_SOURCE',
  );
  const opencodeSource = readBinarySource(
    args.flags,
    'opencode-source',
    'auto',
    'PILOT_OPENCODE_SOURCE',
  );
  const allowExternal = readBool(
    args.flags,
    'allow-external',
    false,
    'PILOT_ALLOW_EXTERNAL',
  );

  return {
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
  };
}
