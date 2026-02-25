#!/usr/bin/env tsx

/**
 * @license
 * Copyright 2026 cofy-x
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Execute a command in the sandbox
 * Usage: pnpm tsx scripts/command-execute.ts [command] [cwd] [timeout]
 */
import { execute_command } from '../src/index.js';

async function main() {
  const command = process.argv[2];
  const cwd = process.argv[3];
  const timeout = process.argv[4] ? parseInt(process.argv[4]) : undefined;

  if (!command) {
    console.error(
      'Usage: pnpm tsx scripts/command-execute.ts <command> [cwd] [timeout]',
    );
    console.error(
      'Example: pnpm tsx scripts/command-execute.ts "ls -la" "." 5000',
    );
    process.exit(1);
  }

  console.log('=== Command Execution ===\n');
  console.log('Command:', command);
  if (cwd) console.log('Working Directory:', cwd);
  if (timeout) console.log('Timeout:', timeout, 'ms');
  console.log();

  try {
    const result = await execute_command(command, cwd, timeout);
    console.log('Result:');
    console.log(JSON.stringify(result, null, 2));

    if (result.exitCode !== 0) {
      process.exit(result.exitCode);
    }
  } catch (error) {
    console.error('Error:', (error as Error).message);
    process.exit(1);
  }
}

main();
