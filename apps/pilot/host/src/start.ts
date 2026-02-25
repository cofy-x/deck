/**
 * @license
 * Copyright 2026 cofy-x
 * SPDX-License-Identifier: Apache-2.0
 */

import type { ParsedArgs } from './types/index.js';
import { runStartOrchestrator } from './start/orchestrator.js';

export async function runStart(args: ParsedArgs): Promise<number> {
  return runStartOrchestrator(args);
}
