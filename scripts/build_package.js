/**
 * @license
 * Copyright 2025 cofy-x
 * SPDX-License-Identifier: Apache-2.0
 */

import { execSync } from 'node:child_process';
import { existsSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

const cwd = process.cwd();

const isPackage = cwd.includes('/packages/') || cwd.includes('\\packages\\');
const isApp = cwd.includes('/apps/') || cwd.includes('\\apps\\');

if (!isPackage && !isApp) {
  console.error('must be invoked from a package or app directory');
  process.exit(1);
}

/**
 * Determine if we should force rebuild based on:
 * 1. FORCE_BUILD environment variable
 * 2. Missing dist directory
 * 3. Missing tsconfig.tsbuildinfo (indicates need for full build)
 */
function shouldForceRebuild() {
  // Explicit force via environment variable
  if (process.env.FORCE_BUILD === 'true' || process.env.FORCE_BUILD === '1') {
    return true;
  }

  const distDir = join(cwd, 'dist');
  const tsbuildInfo = join(cwd, 'tsconfig.tsbuildinfo');

  // Force rebuild if dist doesn't exist
  if (!existsSync(distDir)) {
    return true;
  }

  // Force rebuild if tsbuildinfo doesn't exist (no cache available)
  // This happens after 'pnpm run clean' or fresh clone
  if (!existsSync(tsbuildInfo)) {
    return true;
  }

  return false;
}

// Determine build flags
const forceRebuild = shouldForceRebuild();
const buildFlags = forceRebuild ? '--build --force' : '--build';

if (forceRebuild) {
  console.log('Performing clean rebuild...');
}

// build typescript files
execSync(`tsc ${buildFlags}`, { stdio: 'inherit' });

// copy .{md,json} files
execSync(`node ${join(__dirname, 'copy_files.js')}`, { stdio: 'inherit' });

// touch dist/.last_build
writeFileSync(join(process.cwd(), 'dist', '.last_build'), '');
process.exit(0);
