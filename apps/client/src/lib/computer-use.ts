/**
 * @license
 * Copyright 2026 cofy-x
 * SPDX-License-Identifier: Apache-2.0
 */

const DIRECT_COMPUTER_USE_TOOLS = new Set([
  'screenshot',
  'mouse_click',
  'mouse_move',
  'mouse_drag',
  'mouse_scroll',
  'keyboard_type',
  'keyboard_press',
  'keyboard_hotkey',
  'open_browser',
  'get_display_info',
  'get_windows',
]);

const SHELL_TOOL_NAMES = new Set([
  'bash',
  'shell',
  'sh',
  'zsh',
  'fish',
  'pwsh',
  'powershell',
  'cmd',
]);

type DeckComputerAction =
  | 'screenshot'
  | 'mouse click'
  | 'mouse move'
  | 'mouse drag'
  | 'mouse scroll'
  | 'keyboard type'
  | 'keyboard press'
  | 'keyboard hotkey'
  | 'browser'
  | 'display-info'
  | 'windows';

const DECK_COMPUTER_PATTERNS: Array<{
  action: DeckComputerAction;
  pattern: RegExp;
}> = [
  { action: 'screenshot', pattern: /\bdeck\s+computer\s+screenshot\b/i },
  { action: 'mouse click', pattern: /\bdeck\s+computer\s+mouse\s+click\b/i },
  { action: 'mouse move', pattern: /\bdeck\s+computer\s+mouse\s+move\b/i },
  { action: 'mouse drag', pattern: /\bdeck\s+computer\s+mouse\s+drag\b/i },
  {
    action: 'mouse scroll',
    pattern: /\bdeck\s+computer\s+mouse\s+scroll\b/i,
  },
  {
    action: 'keyboard type',
    pattern: /\bdeck\s+computer\s+keyboard\s+type\b/i,
  },
  {
    action: 'keyboard press',
    pattern: /\bdeck\s+computer\s+keyboard\s+press\b/i,
  },
  {
    action: 'keyboard hotkey',
    pattern: /\bdeck\s+computer\s+keyboard\s+hotkey\b/i,
  },
  { action: 'browser', pattern: /\bdeck\s+computer\s+browser\b/i },
  {
    action: 'display-info',
    pattern: /\bdeck\s+computer\s+display-info\b/i,
  },
  { action: 'windows', pattern: /\bdeck\s+computer\s+windows\b/i },
];

export function normalizeToolName(toolName: string): string {
  return toolName.toLowerCase().replace(/^opencode_/, '');
}

export function isComputerUseTool(toolName: string): boolean {
  return DIRECT_COMPUTER_USE_TOOLS.has(normalizeToolName(toolName));
}

function collectShellCommandCandidates(input: Record<string, unknown>): string[] {
  const keys = ['command', 'cmd', 'script', 'raw', 'text'] as const;
  const candidates: string[] = [];

  for (const key of keys) {
    const value = input[key];
    if (typeof value === 'string' && value.trim().length > 0) {
      candidates.push(value);
    }
  }

  const argv = input['argv'];
  if (
    Array.isArray(argv) &&
    argv.length > 0 &&
    argv.every((item) => typeof item === 'string')
  ) {
    candidates.push(argv.join(' '));
  }

  return candidates;
}

function detectDeckComputerAction(command: string): DeckComputerAction | null {
  for (const entry of DECK_COMPUTER_PATTERNS) {
    if (entry.pattern.test(command)) return entry.action;
  }
  return null;
}

export function detectComputerUseInvocation(
  toolName: string,
  input?: Record<string, unknown>,
): { detected: boolean; displayName: string } {
  const normalized = normalizeToolName(toolName);

  if (DIRECT_COMPUTER_USE_TOOLS.has(normalized)) {
    return { detected: true, displayName: normalized };
  }

  if (!SHELL_TOOL_NAMES.has(normalized) || !input) {
    return { detected: false, displayName: normalized };
  }

  for (const candidate of collectShellCommandCandidates(input)) {
    const action = detectDeckComputerAction(candidate);
    if (action) {
      return {
        detected: true,
        displayName: `deck computer ${action}`,
      };
    }
  }

  return { detected: false, displayName: normalized };
}
