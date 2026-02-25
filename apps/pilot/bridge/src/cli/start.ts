/**
 * @license
 * Copyright 2025 cofy-x
 * SPDX-License-Identifier: Apache-2.0
 */

import type { Command } from 'commander';

import { startBridge } from '../bridge/index.js';
import { SUPPORTED_CHANNELS } from '../channel-meta.js';
import { loadConfig } from '../config.js';
import { createAppLogger, createConsoleReporter } from './helpers.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface StartOptions {
  opencodeUrl?: string;
}

// ---------------------------------------------------------------------------
// Start command
// ---------------------------------------------------------------------------

async function runStart(pathOverride?: string, options?: StartOptions) {
  if (pathOverride?.trim()) {
    process.env['OPENCODE_DIRECTORY'] = pathOverride.trim();
  }
  if (options?.opencodeUrl?.trim()) {
    process.env['OPENCODE_URL'] = options.opencodeUrl.trim();
  }
  const config = loadConfig();
  const logger = createAppLogger(config);
  const reporter = createConsoleReporter();
  if (!process.env['OPENCODE_DIRECTORY']) {
    process.env['OPENCODE_DIRECTORY'] = config.opencodeDirectory;
  }
  const bridge = await startBridge(config, logger, reporter);
  reporter.onStatus?.(
    `Commands: pilot-bridge status, pilot-bridge <channel> status, pilot-bridge --help. Channels: ${SUPPORTED_CHANNELS.join(', ')}`,
  );

  const shutdown = async () => {
    logger.info('shutting down');
    await bridge.stop();
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

export function registerStartCommand(program: Command) {
  program
    .command('start')
    .description('Start the bridge')
    .argument('[path]', 'OpenCode workspace path')
    .option('--opencode-url <url>', 'OpenCode server URL')
    .action((pathArg?: string, options?: StartOptions) =>
      runStart(pathArg, options),
    );
}
