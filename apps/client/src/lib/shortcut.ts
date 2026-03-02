/**
 * @license
 * Copyright 2026 cofy-x
 * SPDX-License-Identifier: Apache-2.0
 */

function isMacPlatform(): boolean {
  if (typeof navigator === 'undefined') return false;
  const uaDataPlatform = (
    navigator as Navigator & { userAgentData?: { platform?: string } }
  ).userAgentData?.platform;
  if (typeof uaDataPlatform === 'string' && uaDataPlatform.length > 0) {
    return /mac|iphone|ipad|ipod/i.test(uaDataPlatform);
  }

  const userAgent = navigator.userAgent ?? '';
  if (/\b(iPhone|iPad|iPod)\b/i.test(userAgent)) return true;

  // iPadOS desktop-mode UA can contain "Macintosh".
  if (/\bMacintosh\b/i.test(userAgent) && navigator.maxTouchPoints > 1) {
    return true;
  }

  return /\bMac OS X\b|\bMacintosh\b|\bMacIntel\b/i.test(userAgent);
}

export function formatShortcutKey(key: string): string {
  const normalized = key.trim().toLowerCase();
  const isMac = isMacPlatform();

  switch (normalized) {
    case 'mod':
      return isMac ? '⌘' : 'Ctrl';
    case 'shift':
      return 'Shift';
    case 'alt':
      return isMac ? 'Option' : 'Alt';
    case 'esc':
    case 'escape':
      return 'Esc';
    case 'enter':
      return 'Enter';
    case 'tab':
      return 'Tab';
    case 'space':
      return 'Space';
    default:
      return key.length === 1 ? key.toUpperCase() : key;
  }
}

export function formatShortcutKeys(keys: readonly string[]): string[] {
  return keys.map(formatShortcutKey);
}
