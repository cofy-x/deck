#!/usr/bin/env node
/**
 * @license
 * Copyright 2026 cofy-x
 * SPDX-License-Identifier: Apache-2.0
 */

import { parseArgs, readBool } from './args.js';
import {
  runApprovals,
  runDaemonCommand,
  runInstanceCommand,
  runStatus,
  runWorkspaceCommand,
} from './commands.js';
import { runStart } from './start.js';
import { printHelp } from './utils/help.js';
import { resolveCliVersion } from './utils/fs.js';

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  if (readBool(args.flags, 'help', false) || args.flags.get('help') === true) {
    printHelp();
    return;
  }
  if (
    readBool(args.flags, 'version', false) ||
    args.flags.get('version') === true
  ) {
    process.stdout.write(`${await resolveCliVersion()}\n`);
    return;
  }

  const command = args.positionals[0] ?? 'start';
  let exitCode = 0;
  if (command === 'start') {
    exitCode = await runStart(args);
  } else if (command === 'serve') {
    exitCode = await runStart(args);
  } else if (command === 'daemon') {
    exitCode = await runDaemonCommand(args);
  } else if (command === 'workspace' || command === 'workspaces') {
    exitCode = await runWorkspaceCommand(args);
  } else if (command === 'instance') {
    exitCode = await runInstanceCommand(args);
  } else if (command === 'approvals') {
    exitCode = await runApprovals(args);
  } else if (command === 'status') {
    exitCode = await runStatus(args);
  } else {
    printHelp();
    exitCode = 1;
  }
  process.exitCode = exitCode;
}

main().catch((error: unknown) => {
  if (error instanceof Error) {
    process.stderr.write(`${error.message}\n`);
    if (error.cause) {
      process.stderr.write(`  Cause: ${error.cause}\n`);
    }
  } else {
    process.stderr.write(`${String(error)}\n`);
  }
  process.exitCode = 1;
});
