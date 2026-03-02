/**
 * @license
 * Copyright 2026 cofy-x
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, expect, it } from 'vitest';

import { normalizeMarkdown } from './markdown-normalize';

describe('normalizeMarkdown', () => {
  it('normalizes 1) ordered markers and nests immediate bullets', () => {
    const input = [
      'Next steps:',
      '1) Capture a screenshot',
      '- Example: deck computer screenshot --format png -o google.png',
      '2) Reopen in incognito mode',
      '- Example: deck computer browser "https://www.google.com" --incognito',
      '3) Extract key page information',
      '- I can help extract title or body text from the page',
    ].join('\n');

    const normalized = normalizeMarkdown(input);

    expect(normalized).toContain('1. Capture a screenshot');
    expect(normalized).toContain('2. Reopen in incognito mode');
    expect(normalized).toContain('3. Extract key page information');
    expect(normalized).toContain(
      '   - Example: deck computer screenshot --format png -o google.png',
    );
    expect(normalized).toContain(
      '   - Example: deck computer browser "https://www.google.com" --incognito',
    );
  });

  it('does not convert unrelated bullet lists later in the section', () => {
    const input = [
      '1) First action',
      '- detail under action',
      '',
      'General notes:',
      '- keep this top-level bullet',
      '- keep this one too',
    ].join('\n');

    const normalized = normalizeMarkdown(input);

    expect(normalized).toContain('1. First action');
    expect(normalized).toContain('   - detail under action');
    expect(normalized).toContain('\nGeneral notes:\n- keep this top-level bullet');
    expect(normalized).toContain('\n- keep this one too');
    expect(normalized).not.toContain('   - keep this top-level bullet');
  });

  it('does not rewrite list-like lines inside fenced code', () => {
    const input = [
      '```bash',
      '1) not a markdown list',
      '- still code',
      '```',
      '',
      '1) real list item',
      '- detail',
    ].join('\n');

    const normalized = normalizeMarkdown(input);

    expect(normalized).toContain('```bash\n1) not a markdown list\n- still code\n```');
    expect(normalized).toContain('\n1. real list item\n');
    expect(normalized).toContain('\n   - detail');
  });

  it('does not normalize list markers inside ```md fenced samples', () => {
    const input = [
      '```md',
      '1) inside markdown sample',
      '- sample bullet',
      '```ts',
      "console.log('nested')",
      '```',
      '```',
      '',
      '1) outside sample',
      '- outside detail',
    ].join('\n');

    const normalized = normalizeMarkdown(input);

    expect(normalized).toContain('\n1) inside markdown sample\n');
    expect(normalized).toContain('\n- sample bullet\n');
    expect(normalized).toContain('\n1. outside sample\n');
    expect(normalized).toContain('\n   - outside detail');
  });

  it('auto-closes unbalanced fenced code blocks', () => {
    const input = ['```ts', 'const value = 1;'].join('\n');
    const normalized = normalizeMarkdown(input);
    expect(normalized).toMatch(/```[\n]?$/);
  });

  it('keeps already-indented bullets as-is', () => {
    const input = ['1) step', '  - already nested'].join('\n');
    const normalized = normalizeMarkdown(input);
    expect(normalized).toContain('1. step');
    expect(normalized).toContain('\n  - already nested');
  });

  it('protects nested fences inside ```md snippets', () => {
    const input = [
      '```md',
      '```ts',
      "console.log('hello')",
      '```',
      '```',
    ].join('\n');

    const normalized = normalizeMarkdown(input);
    expect(normalized).toContain('\u200b```');
  });
});
