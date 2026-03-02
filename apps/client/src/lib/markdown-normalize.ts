/**
 * @license
 * Copyright 2026 cofy-x
 * SPDX-License-Identifier: Apache-2.0
 */

interface FenceState {
  marker: '`' | '~';
  length: number;
}

function parseFenceOpen(line: string): FenceState | null {
  const match = line.match(/^\s*(`{3,}|~{3,})(.*)$/);
  if (!match?.[1]) return null;
  const marker = match[1][0] as '`' | '~';
  return {
    marker,
    length: match[1].length,
  };
}

function isFenceClose(line: string, fence: FenceState): boolean {
  const trimmed = line.trim();
  if (trimmed.length < fence.length) return false;
  if (fence.marker === '`') return /^`+$/.test(trimmed);
  return /^~+$/.test(trimmed);
}

function isOrderedLine(line: string): boolean {
  return /^\s*\d+[.)]\s+/.test(line);
}

function getTopLevelBulletContent(line: string): string | null {
  if (/^\s{2,}(?:[-*+]|[•·])\s+/.test(line)) return null;
  const match = line.match(/^\s*(?:[-*+]|[•·])\s+(.*)$/);
  if (!match) return null;
  return match[1] ?? '';
}

function protectNestedMarkdownFences(lines: string[]): void {
  // Fix nested fences inside ```md / ```markdown snippets.
  // Pattern handled:
  // ```md
  // ...
  // ```ts
  // ...
  // ```   <- nested close (should remain literal)
  // ```   <- outer md close
  for (let i = 0; i < lines.length; i += 1) {
    const openMd = lines[i]?.match(/^\s*```(?:md|markdown)\s*$/i);
    if (!openMd) continue;

    let firstClose = -1;
    for (let j = i + 1; j < lines.length; j += 1) {
      if (/^\s*```\s*$/.test(lines[j] ?? '')) {
        firstClose = j;
        break;
      }
    }
    if (firstClose < 0) continue;

    const hasNestedFenceOpen = lines
      .slice(i + 1, firstClose)
      .some((line) => /^\s*```[a-z0-9_-]+\s*$/i.test(line));
    const hasSecondClose = /^\s*```\s*$/.test(lines[firstClose + 1] ?? '');

    if (hasNestedFenceOpen && hasSecondClose) {
      lines[firstClose] = (lines[firstClose] ?? '').replace(/```/, '\u200b```');
    }
  }
}

/**
 * Normalize markdown to improve rendering stability for common LLM output:
 * - Accept `1)` ordered markers as `1.`
 * - Treat immediate top-level bullets under ordered items as nested children
 * - Preserve fenced code blocks and auto-close unbalanced fences
 */
export function normalizeMarkdown(content: string): string {
  const lines = content.split('\n');
  protectNestedMarkdownFences(lines);

  const outsideFence: boolean[] = [];
  let activeFence: FenceState | null = null;
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i] ?? '';
    outsideFence[i] = activeFence === null;
    if (activeFence === null) {
      const openFence = parseFenceOpen(line);
      if (openFence) activeFence = openFence;
      continue;
    }
    if (isFenceClose(line, activeFence)) {
      activeFence = null;
    }
  }

  // Normalize ordered markers like "1)" to "1." for consistent parsing.
  for (let i = 0; i < lines.length; i += 1) {
    if (!outsideFence[i]) continue;
    lines[i] = (lines[i] ?? '').replace(/^(\s*)(\d+)\)\s+/, '$1$2. ');
  }

  const orderedLineIndexes: number[] = [];
  for (let i = 0; i < lines.length; i += 1) {
    if (!outsideFence[i]) continue;
    if (isOrderedLine(lines[i] ?? '')) {
      orderedLineIndexes.push(i);
    }
  }

  // Normalize an immediate bullet block after each ordered item into nested list
  // items. This keeps ordered numbering continuous while avoiding conversion of
  // unrelated bullet lists later in the section.
  for (let i = 0; i < orderedLineIndexes.length; i += 1) {
    const start = orderedLineIndexes[i];
    const end = orderedLineIndexes[i + 1] ?? lines.length;

    let cursor = start + 1;
    while (cursor < end && /^\s*$/.test(lines[cursor] ?? '')) {
      cursor += 1;
    }

    if (cursor >= end) continue;
    if (getTopLevelBulletContent(lines[cursor] ?? '') === null) continue;

    for (let j = cursor; j < end; j += 1) {
      if (!outsideFence[j]) break;
      const line = lines[j] ?? '';
      const bulletContent = getTopLevelBulletContent(line);
      if (bulletContent !== null) {
        lines[j] = `   - ${bulletContent}`;
        continue;
      }
      if (/^\s*$/.test(line)) {
        lines[j] = '   ';
        continue;
      }
      break;
    }
  }

  const normalized = lines.join('\n');

  // Auto-close unbalanced fenced code blocks so the rest of the message
  // doesn't get swallowed into one giant code section.
  const normalizedLines = normalized.split('\n');
  let unclosedFence: FenceState | null = null;
  for (const line of normalizedLines) {
    if (unclosedFence === null) {
      const openFence = parseFenceOpen(line);
      if (openFence) unclosedFence = openFence;
      continue;
    }
    if (isFenceClose(line, unclosedFence)) {
      unclosedFence = null;
    }
  }

  if (!unclosedFence) return normalized;
  return `${normalized}\n${unclosedFence.marker.repeat(unclosedFence.length)}\n`;
}
