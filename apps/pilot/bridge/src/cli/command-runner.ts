/**
 * @license
 * Copyright 2026 cofy-x
 * SPDX-License-Identifier: Apache-2.0
 */

import type { Command } from 'commander';

import { formatError } from '../utils.js';
import { getOpts, outputJson } from './helpers.js';

export interface CommandRunContext {
  useJson: boolean;
}

export interface RunCommandOptions {
  errorPrefix?: string;
  includeStack?: boolean;
}

export async function runCommand(
  program: Command,
  action: (context: CommandRunContext) => Promise<void>,
  options: RunCommandOptions = {},
): Promise<void> {
  const useJson = getOpts(program).json;
  try {
    await action({ useJson });
  } catch (error) {
    process.exitCode = 1;
    const message = formatError(error);

    if (useJson) {
      outputJson({ success: false, error: message });
      return;
    }

    const prefix = options.errorPrefix?.trim();
    console.error(prefix ? `${prefix}: ${message}` : message);
    if (options.includeStack && error instanceof Error && error.stack) {
      console.error(error.stack);
    }
  }
}
