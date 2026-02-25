#!/usr/bin/env tsx

/**
 * @license
 * Copyright 2026 cofy-x
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Open a URL in the browser
 * Usage: pnpm tsx scripts/browser-open.ts <url> [incognito]
 */
import { open_browser } from '../src/index.js';

async function main() {
  const url = process.argv[2];
  const incognito = process.argv[3] === 'true';

  if (!url) {
    console.error('Usage: pnpm tsx scripts/browser-open.ts <url> [incognito]');
    console.error(
      'Example: pnpm tsx scripts/browser-open.ts "https://example.com" true',
    );
    process.exit(1);
  }

  console.log('=== Open Browser ===\n');
  console.log('URL:', url);
  console.log('Incognito:', incognito);
  console.log();

  try {
    await open_browser(url, incognito);
    console.log('✓ Browser opened');
  } catch (error) {
    console.error('Error:', (error as Error).message);
    process.exit(1);
  }
}

main();
