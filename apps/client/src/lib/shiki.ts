/**
 * @license
 * Copyright 2026 cofy-x
 * SPDX-License-Identifier: Apache-2.0
 */
import type { Highlighter } from 'shiki';

// ---------------------------------------------------------------------------
// Supported languages for syntax highlighting
// ---------------------------------------------------------------------------

const SUPPORTED_LANGUAGES = [
  'typescript',
  'javascript',
  'tsx',
  'jsx',
  'python',
  'bash',
  'shell',
  'json',
  'go',
  'rust',
  'html',
  'css',
  'yaml',
  'markdown',
  'diff',
  'sql',
  'toml',
  'xml',
  'dockerfile',
  'plaintext',
] as const;

export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number];

// ---------------------------------------------------------------------------
// Lazy-loaded singleton highlighter
// ---------------------------------------------------------------------------

let highlighterPromise: Promise<Highlighter> | null = null;

/**
 * Get or create a singleton Shiki highlighter instance.
 *
 * The highlighter is lazily initialized on first call and reused for
 * subsequent calls. It loads a dark theme and a curated set of common
 * programming languages.
 */
export function getHighlighter(): Promise<Highlighter> {
  if (!highlighterPromise) {
    highlighterPromise = import('shiki').then((shiki) =>
      shiki.createHighlighter({
        themes: ['github-dark-default'],
        langs: [...SUPPORTED_LANGUAGES],
      }),
    );
  }
  return highlighterPromise;
}

/**
 * Highlight a code string and return the generated HTML.
 *
 * Falls back to a plain `<pre>` block when the language is unknown or
 * highlighting fails.
 */
export async function highlightCode(
  code: string,
  language: string,
): Promise<string> {
  try {
    const highlighter = await getHighlighter();
    const langs = highlighter.getLoadedLanguages();
    const lang = langs.includes(language) ? language : 'plaintext';
    return highlighter.codeToHtml(code, {
      lang,
      theme: 'github-dark-default',
    });
  } catch {
    // Graceful fallback when Shiki cannot process the input
    const escaped = code
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
    return `<pre class="shiki"><code>${escaped}</code></pre>`;
  }
}

/**
 * Check whether a language identifier is in the supported set.
 */
export function isSupportedLanguage(lang: string): lang is SupportedLanguage {
  return (SUPPORTED_LANGUAGES as readonly string[]).includes(lang);
}
