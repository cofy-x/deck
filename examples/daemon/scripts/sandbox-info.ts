#!/usr/bin/env tsx

/**
 * @license
 * Copyright 2026 cofy-x
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Display sandbox environment information
 * Usage: pnpm tsx scripts/sandbox-info.ts
 */
import {
  get_version,
  get_work_dir,
  get_home_dir,
  get_ports,
} from '../src/index.js';

async function main() {
  console.log('=== Sandbox Environment Info ===\n');

  try {
    const version = await get_version();
    console.log('Daemon Version:', version);

    const workDir = await get_work_dir();
    console.log('Work Directory:', workDir);

    const homeDir = await get_home_dir();
    console.log('Home Directory:', homeDir);

    const ports = await get_ports();
    console.log('Active Ports:', ports);
  } catch (error) {
    console.error('Error:', (error as Error).message);
    process.exit(1);
  }
}

main();
