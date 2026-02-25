/**
 * @license
 * Copyright 2026 cofy-x
 * SPDX-License-Identifier: Apache-2.0
 */
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { t } from '@/i18n';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Detect if we are running inside a Tauri desktop shell.
 */
export function isTauriRuntime(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
}

/**
 * Format a Unix timestamp (seconds or ms) into a human-readable relative time.
 */
export function formatRelativeTime(
  timestamp: number | null | undefined,
): string {
  if (timestamp == null) return '';
  // Handle both seconds and milliseconds
  const ms = timestamp > 1e12 ? timestamp : timestamp * 1000;
  const diff = Date.now() - ms;
  const seconds = Math.floor(diff / 1000);

  if (seconds < 60) return t('time.just_now');
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return t('time.minutes_ago').replace('{n}', String(minutes));
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return t('time.hours_ago').replace('{n}', String(hours));
  const days = Math.floor(hours / 24);
  return t('time.days_ago').replace('{n}', String(days));
}
