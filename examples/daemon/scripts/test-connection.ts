#!/usr/bin/env tsx

/**
 * @license
 * Copyright 2026 cofy-x
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Test connectivity to deck daemon
 * Usage: pnpm tsx scripts/test-connection.ts
 */
import { OpenAPI } from '@cofy-x/client-daemon';

async function main() {
  const daemonUrl = process.env.DECK_DAEMON_URL || 'http://localhost:2280';
  OpenAPI.BASE = daemonUrl;

  console.log(`Testing connection to: ${daemonUrl}\n`);

  try {
    const response = await fetch(`${daemonUrl}/version`);

    if (response.ok) {
      const data = await response.json();
      console.log('✓ Connection successful');
      console.log('Version:', data);
    } else {
      console.error('✗ Connection failed');
      console.error('Status:', response.status);
      process.exit(1);
    }
  } catch (error) {
    console.error('✗ Connection failed');
    console.error('Error:', (error as Error).message);
    process.exit(1);
  }
}

main();
