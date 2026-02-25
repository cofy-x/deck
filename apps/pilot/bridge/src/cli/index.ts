#!/usr/bin/env node
/**
 * @license
 * Copyright 2025 cofy-x
 * SPDX-License-Identifier: Apache-2.0
 */

import fs from 'node:fs';

import { Command } from 'commander';
import { z } from 'zod';

import { registerConfigCommands } from './config-cmd.js';
import { registerDingTalkCommands } from './dingtalk-cmd.js';
import { registerDiscordCommands } from './discord-cmd.js';
import { registerEmailCommands } from './email-cmd.js';
import { registerFeishuCommands } from './feishu-cmd.js';
import { registerHealthCommand } from './health-cmd.js';
import { parseJsonTextWithSchema } from '../safe-json.js';
import { formatError } from '../utils.js';
import { getOpts, outputJson } from './helpers.js';
import { registerMochatCommands } from './mochat-cmd.js';
import { registerPairingCommands } from './pairing-cmd.js';
import { registerQqCommands } from './qq-cmd.js';
import { registerSendCommand } from './send-cmd.js';
import { registerSlackCommands } from './slack-cmd.js';
import { registerStartCommand } from './start.js';
import { registerStatusCommand } from './status-cmd.js';
import { registerTelegramCommands } from './telegram-cmd.js';
import { registerWhatsAppCommands } from './whatsapp-cmd.js';

// ---------------------------------------------------------------------------
// Version detection
// ---------------------------------------------------------------------------

declare const __BRIDGE_VERSION__: string | undefined;

const PackageJsonSchema = z.object({
  version: z.string().optional(),
});

const VERSION = (() => {
  if (typeof __BRIDGE_VERSION__ === 'string' && __BRIDGE_VERSION__.trim()) {
    return __BRIDGE_VERSION__.trim();
  }
  try {
    const pkgPath = new URL('../../package.json', import.meta.url);
    const pkg = parseJsonTextWithSchema(
      fs.readFileSync(pkgPath, 'utf8'),
      PackageJsonSchema,
      'bridge package manifest',
    );
    if (typeof pkg.version === 'string' && pkg.version.trim()) {
      return pkg.version.trim();
    }
  } catch {
    // ignore
  }
  return '0.0.0';
})();

// ---------------------------------------------------------------------------
// Commander setup
// ---------------------------------------------------------------------------

const program = new Command();

program
  .name('bridge')
  .version(VERSION)
  .description('OpenCode multi-channel bridge')
  .option('--json', 'Output in JSON format', false);

// Register all command modules
registerStartCommand(program);
registerHealthCommand(program);
registerStatusCommand(program);
registerConfigCommands(program);
registerWhatsAppCommands(program);
registerTelegramCommands(program);
registerSlackCommands(program);
registerFeishuCommands(program);
registerDiscordCommands(program);
registerDingTalkCommands(program);
registerEmailCommands(program);
registerMochatCommands(program);
registerQqCommands(program);
registerPairingCommands(program);
registerSendCommand(program);

// ---------------------------------------------------------------------------
// Parse and run
// ---------------------------------------------------------------------------

if (process.argv.length <= 2) {
  program.outputHelp();
  process.exit(0);
}

program.parseAsync(process.argv).catch((error) => {
  const useJson = getOpts(program).json;
  if (useJson) {
    outputJson({ error: formatError(error) });
  } else {
    console.error(error);
  }
  process.exitCode = 1;
});
