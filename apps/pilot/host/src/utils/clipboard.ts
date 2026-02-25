/**
 * @license
 * Copyright 2026 cofy-x
 * SPDX-License-Identifier: Apache-2.0
 */

import { spawn } from 'node:child_process';

// ---------------------------------------------------------------------------
// Clipboard helpers
// ---------------------------------------------------------------------------

interface ClipboardCommand {
  command: string;
  args: string[];
}

interface ClipboardResult {
  copied: boolean;
  error?: string;
}

async function runClipboardCommand(
  command: string,
  args: string[],
  text: string,
): Promise<boolean> {
  return new Promise((resolve) => {
    const child = spawn(command, args, { stdio: ['pipe', 'ignore', 'ignore'] });
    child.on('error', () => resolve(false));
    child.stdin?.write(text);
    child.stdin?.end();
    child.on('exit', (code) => resolve(code === 0));
  });
}

export async function copyToClipboard(text: string): Promise<ClipboardResult> {
  const platform = process.platform;
  const commands: ClipboardCommand[] = [];
  if (platform === 'darwin') {
    commands.push({ command: 'pbcopy', args: [] });
  } else if (platform === 'win32') {
    commands.push({ command: 'clip', args: [] });
  } else {
    commands.push({ command: 'wl-copy', args: [] });
    commands.push({ command: 'xclip', args: ['-selection', 'clipboard'] });
    commands.push({ command: 'xsel', args: ['--clipboard', '--input'] });
  }
  for (const entry of commands) {
    try {
      const ok = await runClipboardCommand(entry.command, entry.args, text);
      if (ok) return { copied: true };
    } catch {
      // ignore
    }
  }
  return { copied: false, error: 'Clipboard unavailable' };
}
