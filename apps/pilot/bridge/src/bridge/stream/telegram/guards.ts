/**
 * @license
 * Copyright 2026 cofy-x
 * SPDX-License-Identifier: Apache-2.0
 */

import type { RunState, TelegramRunState } from '../../../types/index.js';
import { isTelegramRun } from '../../state/run-state.js';

export interface ResolveRunOptions {
  includeSuppressed?: boolean;
}

export function resolveTelegramRun(
  activeRuns: Map<string, RunState>,
  sessionID: string,
  options: ResolveRunOptions = {},
): TelegramRunState | null {
  const run = activeRuns.get(sessionID);
  if (!run || !isTelegramRun(run)) {
    return null;
  }
  if (!options.includeSuppressed && run.telegram.streamingSuppressed) {
    return null;
  }
  return run;
}
