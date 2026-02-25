/**
 * @license
 * Copyright 2026 cofy-x
 * SPDX-License-Identifier: Apache-2.0
 */
import { describe, expect, it } from 'vitest';
import { detectComputerUseInvocation } from './computer-use';

describe('detectComputerUseInvocation', () => {
  it('detects direct computer-use tool names', () => {
    const result = detectComputerUseInvocation('opencode_mouse_click');
    expect(result).toEqual({
      detected: true,
      displayName: 'mouse_click',
    });
  });

  it('detects deck computer commands routed through shell tool', () => {
    const result = detectComputerUseInvocation('bash', {
      command: 'deck computer browser "https://www.baidu.com"',
    });
    expect(result).toEqual({
      detected: true,
      displayName: 'deck computer browser',
    });
  });

  it('detects deck computer commands in complex shell chains', () => {
    const result = detectComputerUseInvocation('shell', {
      command: 'echo ready && deck computer keyboard hotkey ctrl shift p',
    });
    expect(result).toEqual({
      detected: true,
      displayName: 'deck computer keyboard hotkey',
    });
  });

  it('ignores unrelated shell commands', () => {
    const result = detectComputerUseInvocation('bash', {
      command: 'ls -la && echo done',
    });
    expect(result).toEqual({
      detected: false,
      displayName: 'bash',
    });
  });
});
