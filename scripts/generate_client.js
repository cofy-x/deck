/**
 * @license
 * Copyright 2025 cofy-x
 * SPDX-License-Identifier: Apache-2.0
 */

import { execSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

async function main() {
  try {
    console.log('📄 Generating Swagger JSON from Go source...');
    try {
      execSync('make gen-swagger', {
        cwd: root,
        stdio: 'inherit',
      });
    } catch {
      console.error(
        '❌ Swagger generation failed. Ensure "swag" is installed and code compiles.',
      );
      process.exit(1);
    }

    console.log('🛠  Generating Daemon TypeScript client...');
    execSync('pnpm --filter @cofy-x/client-daemon run generate', {
      stdio: 'inherit',
      cwd: root,
    });

    console.log('📦 Building Daemon client package...');
    execSync('pnpm --filter @cofy-x/client-daemon run build', {
      stdio: 'inherit',
      cwd: root,
    });

    console.log('✅ Success! All clients updated.');
  } catch (err) {
    console.error('❌ Error:', err.message);
    process.exit(1);
  }
}

main();
