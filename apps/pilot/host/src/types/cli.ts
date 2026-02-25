/**
 * @license
 * Copyright 2026 cofy-x
 * SPDX-License-Identifier: Apache-2.0
 */

import type { ChildProcess } from 'node:child_process';

// ---------------------------------------------------------------------------
// Approval
// ---------------------------------------------------------------------------

export type ApprovalMode = 'manual' | 'auto';

// ---------------------------------------------------------------------------
// CLI flag types
// ---------------------------------------------------------------------------

export type FlagValue = string | boolean;

export type FlagMap = Map<string, FlagValue>;

export interface ParsedArgs {
  positionals: string[];
  flags: FlagMap;
}

// ---------------------------------------------------------------------------
// Child process handle
// ---------------------------------------------------------------------------

export interface ChildHandle {
  name: string;
  child: ChildProcess;
}
