/**
 * @license
 * Copyright 2026 cofy-x
 * SPDX-License-Identifier: Apache-2.0
 */
import { en, zh } from './locales';
import { LANGUAGE_PREF_KEY } from '@/lib/constants';

export type Language = 'en' | 'zh';
export type Locale = Language;

export const LANGUAGES: Language[] = ['en', 'zh'];

export const LANGUAGE_OPTIONS = [
  { value: 'en' as Language, label: 'English', nativeName: 'English' },
  {
    value: 'zh' as Language,
    label: 'Simplified Chinese',
    nativeName: '简体中文',
  },
] as const;

const TRANSLATIONS: Record<Language, Record<string, string>> = { en, zh };

export const isLanguage = (value: unknown): value is Language =>
  typeof value === 'string' && LANGUAGES.includes(value as Language);

let _locale: Language = 'en';

export const currentLocale = (): Language => _locale;

export const setLocale = (newLocale: Language) => {
  if (!isLanguage(newLocale)) {
    console.warn(`Invalid locale: ${String(newLocale)}, falling back to "en"`);
    _locale = 'en';
    return;
  }
  _locale = newLocale;
  if (typeof window !== 'undefined') {
    try {
      window.localStorage.setItem(LANGUAGE_PREF_KEY, newLocale);
    } catch (e) {
      console.warn('Failed to persist language preference:', e);
    }
  }
};

export const t = (key: string, localeOverride?: Language): string => {
  const loc = localeOverride ?? _locale;
  if (TRANSLATIONS[loc]?.[key]) return TRANSLATIONS[loc][key];
  if (loc !== 'en' && TRANSLATIONS.en?.[key]) return TRANSLATIONS.en[key];
  return key;
};

export const initLocale = (): Language => {
  if (typeof window === 'undefined') return 'en';
  try {
    const stored = window.localStorage.getItem(LANGUAGE_PREF_KEY);
    if (isLanguage(stored)) {
      _locale = stored;
      return stored;
    }
  } catch (e) {
    console.warn('Failed to read language preference:', e);
  }
  return 'en';
};
