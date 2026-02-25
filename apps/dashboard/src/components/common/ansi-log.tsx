/**
 * @license
 * Copyright 2025 cofy-x
 * SPDX-License-Identifier: Apache-2.0
 */

import { memo, useMemo } from 'react';

// ANSI color codes mapping to Tailwind CSS classes
const ANSI_COLORS: Record<number, string> = {
  // Standard colors (foreground)
  30: 'text-black dark:text-gray-900',
  31: 'text-red-600 dark:text-red-400',
  32: 'text-green-600 dark:text-green-400',
  33: 'text-yellow-600 dark:text-yellow-400',
  34: 'text-blue-600 dark:text-blue-400',
  35: 'text-purple-600 dark:text-purple-400',
  36: 'text-cyan-600 dark:text-cyan-400',
  37: 'text-gray-200 dark:text-gray-300',
  // Bright colors (foreground)
  90: 'text-gray-500 dark:text-gray-500',
  91: 'text-red-500 dark:text-red-300',
  92: 'text-green-500 dark:text-green-300',
  93: 'text-yellow-500 dark:text-yellow-300',
  94: 'text-blue-500 dark:text-blue-300',
  95: 'text-purple-500 dark:text-purple-300',
  96: 'text-cyan-500 dark:text-cyan-300',
  97: 'text-white dark:text-gray-100',
};

const ANSI_BG_COLORS: Record<number, string> = {
  // Standard colors (background)
  40: 'bg-black',
  41: 'bg-red-600',
  42: 'bg-green-600',
  43: 'bg-yellow-600',
  44: 'bg-blue-600',
  45: 'bg-purple-600',
  46: 'bg-cyan-600',
  47: 'bg-gray-200',
  // Bright colors (background)
  100: 'bg-gray-500',
  101: 'bg-red-500',
  102: 'bg-green-500',
  103: 'bg-yellow-500',
  104: 'bg-blue-500',
  105: 'bg-purple-500',
  106: 'bg-cyan-500',
  107: 'bg-white',
};

interface TextSegment {
  text: string;
  classes: string[];
}

/**
 * Parse ANSI escape sequences and convert to styled segments
 */
function parseAnsiText(text: string): TextSegment[] {
  const segments: TextSegment[] = [];
  // Match ANSI escape sequences: ESC[ ... m
  // ESC can be \x1b, \033, or \e
  // eslint-disable-next-line no-control-regex
  const ansiRegex = /\x1b\[([0-9;]*)m/g;

  let lastIndex = 0;
  let currentClasses: string[] = [];
  let match;

  while ((match = ansiRegex.exec(text)) !== null) {
    // Add text before the escape sequence
    if (match.index > lastIndex) {
      const textBefore = text.slice(lastIndex, match.index);
      if (textBefore) {
        segments.push({ text: textBefore, classes: [...currentClasses] });
      }
    }

    // Parse the escape sequence codes
    const codes = match[1].split(';').map(Number);

    for (const code of codes) {
      if (code === 0) {
        // Reset all attributes
        currentClasses = [];
      } else if (code === 1) {
        // Bold
        currentClasses.push('font-bold');
      } else if (code === 2) {
        // Dim
        currentClasses.push('opacity-70');
      } else if (code === 3) {
        // Italic
        currentClasses.push('italic');
      } else if (code === 4) {
        // Underline
        currentClasses.push('underline');
      } else if (ANSI_COLORS[code]) {
        // Remove any existing text color classes
        currentClasses = currentClasses.filter((c) => !c.startsWith('text-'));
        currentClasses.push(ANSI_COLORS[code]);
      } else if (ANSI_BG_COLORS[code]) {
        // Remove any existing background color classes
        currentClasses = currentClasses.filter((c) => !c.startsWith('bg-'));
        currentClasses.push(ANSI_BG_COLORS[code]);
      }
    }

    lastIndex = ansiRegex.lastIndex;
  }

  // Add any remaining text
  if (lastIndex < text.length) {
    const remainingText = text.slice(lastIndex);
    if (remainingText) {
      segments.push({ text: remainingText, classes: [...currentClasses] });
    }
  }

  // If no segments were created, return the original text
  if (segments.length === 0 && text) {
    segments.push({ text, classes: [] });
  }

  return segments;
}

/**
 * Render a single line with ANSI color support
 */
const AnsiLine = memo(({ line }: { line: string }) => {
  const segments = useMemo(() => parseAnsiText(line), [line]);

  return (
    <div className="whitespace-pre-wrap">
      {segments.map((segment, index) => (
        <span key={index} className={segment.classes.join(' ')}>
          {segment.text}
        </span>
      ))}
    </div>
  );
});

AnsiLine.displayName = 'AnsiLine';

interface AnsiLogProps {
  lines: string[];
  className?: string;
}

/**
 * AnsiLog component - renders log lines with ANSI color code support
 */
export const AnsiLog = memo(({ lines, className = '' }: AnsiLogProps) => (
  <div className={`space-y-0.5 ${className}`}>
    {lines.map((line, index) => (
      <AnsiLine key={index} line={line} />
    ))}
  </div>
));

AnsiLog.displayName = 'AnsiLog';
