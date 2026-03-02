/**
 * @license
 * Copyright 2026 cofy-x
 * SPDX-License-Identifier: Apache-2.0
 */

import { afterEach, describe, expect, it } from 'vitest';

import { formatShortcutKey, formatShortcutKeys } from './shortcut';

type NavigatorLike = {
  userAgent?: string;
  maxTouchPoints?: number;
  userAgentData?: { platform?: string };
};

const originalNavigatorDescriptor = Object.getOwnPropertyDescriptor(
  globalThis,
  'navigator',
);

function mockNavigator(value: NavigatorLike | undefined) {
  Object.defineProperty(globalThis, 'navigator', {
    value,
    configurable: true,
    enumerable: true,
    writable: true,
  });
}

afterEach(() => {
  if (originalNavigatorDescriptor) {
    Object.defineProperty(globalThis, 'navigator', originalNavigatorDescriptor);
    return;
  }
  delete (globalThis as Record<string, unknown>)['navigator'];
});

describe('formatShortcutKey', () => {
  it('maps mod to Ctrl when navigator is unavailable', () => {
    mockNavigator(undefined);
    expect(formatShortcutKey('mod')).toBe('Ctrl');
  });

  it('maps mod to command key on mac via userAgentData platform', () => {
    mockNavigator({
      userAgent: 'Mozilla/5.0',
      maxTouchPoints: 0,
      userAgentData: { platform: 'macOS' },
    });
    expect(formatShortcutKey('mod')).toBe('⌘');
  });

  it('maps mod to Ctrl on non-mac platform', () => {
    mockNavigator({
      userAgent: 'Mozilla/5.0',
      maxTouchPoints: 0,
      userAgentData: { platform: 'Windows' },
    });
    expect(formatShortcutKey('mod')).toBe('Ctrl');
  });

  it('treats iPadOS desktop-mode UA as mac platform', () => {
    mockNavigator({
      userAgent:
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15',
      maxTouchPoints: 5,
    });
    expect(formatShortcutKey('mod')).toBe('⌘');
  });

  it('formats known keys and uppercases single-letter keys', () => {
    mockNavigator({
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
      maxTouchPoints: 0,
    });
    expect(formatShortcutKey('escape')).toBe('Esc');
    expect(formatShortcutKey('a')).toBe('A');
    expect(formatShortcutKey('alt')).toBe('Alt');
  });
});

describe('formatShortcutKeys', () => {
  it('formats key sequences in order', () => {
    mockNavigator({
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
      maxTouchPoints: 0,
    });
    expect(formatShortcutKeys(['mod', 'shift', 'v'])).toEqual([
      '⌘',
      'Shift',
      'V',
    ]);
  });
});
