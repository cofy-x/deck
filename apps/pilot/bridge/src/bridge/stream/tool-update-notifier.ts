/**
 * @license
 * Copyright 2026 cofy-x
 * SPDX-License-Identifier: Apache-2.0
 */

import { formatInputSummary, truncateText } from '../../text.js';
import type {
  Config,
  MessagePartProps,
  RunState,
  SendTextFn,
} from '../../types/index.js';
import { TOOL_LABELS } from '../support/constants.js';

type InputSummaryValue = string | number | boolean | null;

function toInputSummary(
  input: Record<string, unknown> | undefined,
): Record<string, InputSummaryValue> {
  if (!input) return {};

  const normalized: Record<string, InputSummaryValue> = {};
  for (const [key, value] of Object.entries(input)) {
    if (
      typeof value === 'string' ||
      typeof value === 'number' ||
      typeof value === 'boolean' ||
      value === null
    ) {
      normalized[key] = value;
    }
  }
  return normalized;
}

export class ToolUpdateNotifier {
  constructor(
    private readonly config: Config,
    private readonly sendText: SendTextFn,
  ) {}

  async notify(run: RunState, part: MessagePartProps['part']): Promise<void> {
    if (!run.toolUpdatesEnabled || part.type !== 'tool') return;

    const callId = part.callID;
    const state = part.state;
    const status = state.status;
    if (run.seenToolStates.get(callId) === status) return;
    run.seenToolStates.set(callId, status);

    const toolName = part.tool;
    const label = TOOL_LABELS[toolName] ?? toolName;
    const title =
      ('title' in state && typeof state.title === 'string' ? state.title : undefined) ||
      truncateText(formatInputSummary(toInputSummary(state.input)), 120) ||
      'running';
    let message = `[tool] ${label} ${status}: ${title}`;

    if (status === 'completed') {
      const output = truncateText(
        state.output.trim(),
        this.config.toolOutputLimit,
      );
      if (output) {
        message += `\n${output}`;
      }
    }

    await this.sendText(run.channel, run.peerId, message, { kind: 'tool' });
  }
}
