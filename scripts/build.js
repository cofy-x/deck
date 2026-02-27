/**
 * @license
 * Copyright 2025 cofy-x
 * SPDX-License-Identifier: Apache-2.0
 */

import { execSync } from 'node:child_process';
import { existsSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

// Clean dist directories before building (optional - can be customized per project)
const distDirsToClean = [
  join(root, 'packages', 'core-ts', 'dist'),
  join(root, 'apps', 'pilot', 'bridge', 'dist'),
  join(root, 'apps', 'pilot', 'server', 'dist'),
  join(root, 'apps', 'pilot', 'host', 'dist'),
];

for (const distDir of distDirsToClean) {
  try {
    if (existsSync(distDir)) {
      rmSync(distDir, { recursive: true, force: true });
    }
  } catch {
    // Ignore errors during cleanup
  }
}

if (!existsSync(join(root, 'node_modules'))) {
  console.log('Installing dependencies...');
  execSync('pnpm install', { stdio: 'inherit', cwd: root });
}

console.log('Phase 1: Building Infrastructure & Packages...');
execSync('pnpm --filter "./packages/core-ts" run build', {
  stdio: 'inherit',
  cwd: root,
});

execSync('pnpm --filter "./packages/client-daemon-ts" run build', {
  stdio: 'inherit',
  cwd: root,
});

console.log('Phase 1.1: Building Pilot Infrastructure & Packages...');
execSync('pnpm --filter "./apps/pilot/bridge" run build', {
  stdio: 'inherit',
  cwd: root,
});

execSync('pnpm --filter "./apps/pilot/server" run build', {
  stdio: 'inherit',
  cwd: root,
});

// Critical Step: Re-run install to refresh symlinks and package metadata now that dist folders exist.
// This prevents 'module not found' errors in apps that depend on the newly built packages.
execSync('pnpm install', { stdio: 'inherit', cwd: root });

console.log('Phase 2: Building Applications...');
execSync('pnpm --filter "./apps/api" run build', {
  stdio: 'inherit',
  cwd: root,
});

execSync('pnpm --filter "./apps/dashboard" run build', {
  stdio: 'inherit',
  cwd: root,
});

execSync('pnpm --filter "./apps/landing" run build', {
  stdio: 'inherit',
  cwd: root,
});

execSync('pnpm --filter "./apps/pilot/host" run build', {
  stdio: 'inherit',
  cwd: root,
});
