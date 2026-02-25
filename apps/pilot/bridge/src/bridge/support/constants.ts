/**
 * @license
 * Copyright 2025 cofy-x
 * SPDX-License-Identifier: Apache-2.0
 */

import { CHANNEL_LABELS } from '../../adapters/registry.js';
import type { ModelRef } from '../../types/index.js';

export { CHANNEL_LABELS };

// ---------------------------------------------------------------------------
// Tool display labels
// ---------------------------------------------------------------------------

export const TOOL_LABELS: Record<string, string> = {
  bash: 'bash',
  read: 'read',
  write: 'write',
  edit: 'edit',
  patch: 'patch',
  multiedit: 'edit',
  grep: 'grep',
  glob: 'glob',
  task: 'agent',
  webfetch: 'webfetch',
};

// ---------------------------------------------------------------------------
// Typing indicator interval
// ---------------------------------------------------------------------------

export const TYPING_INTERVAL_MS = 6000;

// ---------------------------------------------------------------------------
// Model presets for quick switching
// ---------------------------------------------------------------------------

export const MODEL_PRESETS: Record<string, ModelRef> = {
  opus: { providerID: 'anthropic', modelID: 'claude-opus-4-5-20251101' },
  codex: { providerID: 'openai', modelID: 'gpt-5.2-codex' },
};
