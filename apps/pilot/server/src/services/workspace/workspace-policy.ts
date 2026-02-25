/**
 * @license
 * Copyright 2026 cofy-x
 * SPDX-License-Identifier: Apache-2.0
 */

import type { ReloadTrigger } from '../../types/index.js';
import { ApiError } from '../../errors.js';

export function ensureWritable(readOnly: boolean): void {
  if (readOnly) {
    throw new ApiError(403, 'read_only', 'Server is read-only');
  }
}

export function buildConfigTrigger(path: string): ReloadTrigger {
  const name = path.split(/[\\/]/).filter(Boolean).pop();
  return {
    type: 'config',
    name: name || 'opencode.json',
    action: 'updated',
    path,
  };
}
