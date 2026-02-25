/**
 * @license
 * Copyright 2026 cofy-x
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, expect, it } from 'vitest';
import type { Part, TextPart, ReasoningPart } from '@opencode-ai/sdk/v2/client';

import {
  isStreamTextPart,
  mergePartPreferNonRegressingText,
  mergeMessagesPreferNonRegressingText,
  mergeDeltaIntoPart,
  mergeDeltaWithFallback,
  applyPendingDeltas,
  compactPendingDeltas,
  type MessageWithParts,
  type PendingPartDelta,
} from './stream-delta-merge';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function textPart(overrides: Partial<TextPart> = {}): TextPart {
  return {
    id: 'part-1',
    sessionID: 'sess-1',
    messageID: 'msg-1',
    type: 'text',
    text: '',
    ...overrides,
  };
}

function reasoningPart(overrides: Partial<ReasoningPart> = {}): ReasoningPart {
  return {
    id: 'part-r1',
    sessionID: 'sess-1',
    messageID: 'msg-1',
    type: 'reasoning',
    text: '',
    time: { start: 1000 },
    ...overrides,
  };
}

function toolPart(): Part {
  return {
    id: 'part-tool',
    sessionID: 'sess-1',
    messageID: 'msg-1',
    type: 'tool',
    tool: 'shell',
    callID: 'call-1',
    state: { status: 'running', input: {} },
  } as Part;
}

function makeMessage(
  id: string,
  parts: Part[],
): MessageWithParts {
  return {
    info: {
      id,
      sessionID: 'sess-1',
      role: 'assistant',
      time: { created: Date.now() },
    },
    parts,
  } as MessageWithParts;
}

// ---------------------------------------------------------------------------
// isStreamTextPart
// ---------------------------------------------------------------------------

describe('isStreamTextPart', () => {
  it('returns true for text parts', () => {
    expect(isStreamTextPart(textPart())).toBe(true);
  });

  it('returns true for reasoning parts', () => {
    expect(isStreamTextPart(reasoningPart())).toBe(true);
  });

  it('returns false for tool parts', () => {
    expect(isStreamTextPart(toolPart())).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// mergePartPreferNonRegressingText
// ---------------------------------------------------------------------------

describe('mergePartPreferNonRegressingText', () => {
  it('returns nextPart when previousPart is undefined', () => {
    const next = textPart({ text: 'hello' });
    expect(mergePartPreferNonRegressingText(undefined, next)).toBe(next);
  });

  it('returns nextPart when IDs differ', () => {
    const prev = textPart({ id: 'a', text: 'long text' });
    const next = textPart({ id: 'b', text: 'short' });
    expect(mergePartPreferNonRegressingText(prev, next)).toBe(next);
  });

  it('returns nextPart when types differ', () => {
    const prev = textPart({ text: 'long text' });
    const next = reasoningPart({ id: 'part-1', text: 'lo' });
    expect(mergePartPreferNonRegressingText(prev, next)).toBe(next);
  });

  it('keeps previous text when next is a shorter prefix', () => {
    const prev = textPart({ text: 'hello world' });
    const next = textPart({ text: 'hello' });
    const result = mergePartPreferNonRegressingText(prev, next);
    expect(result.type === 'text' && result.text).toBe('hello world');
  });

  it('accepts next when next is longer', () => {
    const prev = textPart({ text: 'hello' });
    const next = textPart({ text: 'hello world' });
    expect(mergePartPreferNonRegressingText(prev, next)).toBe(next);
  });

  it('accepts next when next is completely different', () => {
    const prev = textPart({ text: 'alpha' });
    const next = textPart({ text: 'beta' });
    expect(mergePartPreferNonRegressingText(prev, next)).toBe(next);
  });

  it('accepts next when texts are identical', () => {
    const prev = textPart({ text: 'same' });
    const next = textPart({ text: 'same' });
    expect(mergePartPreferNonRegressingText(prev, next)).toBe(next);
  });

  it('bypasses non-stream parts (tool)', () => {
    const prev = toolPart();
    const next = toolPart();
    expect(mergePartPreferNonRegressingText(prev, next)).toBe(next);
  });

  it('works with reasoning parts', () => {
    const prev = reasoningPart({ text: 'thinking deeply' });
    const next = reasoningPart({ text: 'thinking' });
    const result = mergePartPreferNonRegressingText(prev, next);
    expect(result.type === 'reasoning' && result.text).toBe('thinking deeply');
  });
});

// ---------------------------------------------------------------------------
// mergeMessagesPreferNonRegressingText
// ---------------------------------------------------------------------------

describe('mergeMessagesPreferNonRegressingText', () => {
  it('returns nextMessages when previous is undefined', () => {
    const next = [makeMessage('m1', [textPart({ text: 'hello' })])];
    expect(mergeMessagesPreferNonRegressingText(undefined, next)).toBe(next);
  });

  it('returns nextMessages when previous is empty', () => {
    const next = [makeMessage('m1', [textPart({ text: 'hello' })])];
    expect(mergeMessagesPreferNonRegressingText([], next)).toBe(next);
  });

  it('returns empty when next is empty', () => {
    const prev = [makeMessage('m1', [textPart({ text: 'hello' })])];
    expect(mergeMessagesPreferNonRegressingText(prev, [])).toEqual([]);
  });

  it('prevents text regression across messages', () => {
    const prev = [
      makeMessage('m1', [textPart({ text: 'full text here' })]),
    ];
    const next = [
      makeMessage('m1', [textPart({ text: 'full text' })]),
    ];
    const result = mergeMessagesPreferNonRegressingText(prev, next);
    expect(result[0].parts[0].type === 'text' && result[0].parts[0].text).toBe(
      'full text here',
    );
  });

  it('accepts longer text from next', () => {
    const prev = [makeMessage('m1', [textPart({ text: 'short' })])];
    const next = [makeMessage('m1', [textPart({ text: 'short and long' })])];
    const result = mergeMessagesPreferNonRegressingText(prev, next);
    expect(result[0].parts[0].type === 'text' && result[0].parts[0].text).toBe(
      'short and long',
    );
  });

  it('handles new messages not present in previous', () => {
    const prev = [makeMessage('m1', [textPart({ text: 'a' })])];
    const next = [
      makeMessage('m1', [textPart({ text: 'ab' })]),
      makeMessage('m2', [textPart({ text: 'new' })]),
    ];
    const result = mergeMessagesPreferNonRegressingText(prev, next);
    expect(result).toHaveLength(2);
    expect(result[1].parts[0].type === 'text' && result[1].parts[0].text).toBe('new');
  });
});

// ---------------------------------------------------------------------------
// mergeDeltaIntoPart
// ---------------------------------------------------------------------------

describe('mergeDeltaIntoPart', () => {
  it('returns null for empty field', () => {
    expect(mergeDeltaIntoPart(textPart(), '', 'hello')).toBeNull();
  });

  it('returns null for empty delta', () => {
    expect(mergeDeltaIntoPart(textPart(), 'text', '')).toBeNull();
  });

  it('creates field when it does not exist', () => {
    const part = textPart();
    delete (part as Record<string, unknown>)['text'];
    const result = mergeDeltaIntoPart(part, 'text', 'hello');
    expect(result).not.toBeNull();
    expect((result as TextPart).text).toBe('hello');
  });

  it('appends delta to existing text field', () => {
    const part = textPart({ text: 'hello' });
    const result = mergeDeltaIntoPart(part, 'text', ' world');
    expect(result).not.toBeNull();
    expect((result as TextPart).text).toBe('hello world');
  });

  it('handles nested field paths', () => {
    const part = {
      ...textPart(),
      state: { output: 'pre' },
    } as unknown as Part;
    const result = mergeDeltaIntoPart(part, 'state.output', '-fix');
    expect(result).not.toBeNull();
    expect((result as unknown as Record<string, { output: string; }>)['state'].output).toBe(
      'pre-fix',
    );
  });

  it('creates intermediate objects for missing nested paths', () => {
    const part = textPart();
    const result = mergeDeltaIntoPart(part, 'meta.label', 'val');
    expect(result).not.toBeNull();
    expect(
      (result as unknown as Record<string, { label: string; }>)['meta'].label,
    ).toBe('val');
  });

  it('returns null when non-string leaf exists', () => {
    const part = {
      ...textPart(),
      count: 42,
    } as unknown as Part;
    expect(mergeDeltaIntoPart(part, 'count', '1')).toBeNull();
  });

  it('does not mutate the original part', () => {
    const part = textPart({ text: 'original' });
    mergeDeltaIntoPart(part, 'text', ' extra');
    expect(part.text).toBe('original');
  });
});

// ---------------------------------------------------------------------------
// mergeDeltaWithFallback
// ---------------------------------------------------------------------------

describe('mergeDeltaWithFallback', () => {
  it('applies delta via mergeDeltaIntoPart for text field', () => {
    const part = textPart({ text: 'hello' });
    const result = mergeDeltaWithFallback(part, 'text', ' world');
    expect(result).not.toBeNull();
    expect((result as TextPart).text).toBe('hello world');
  });

  it('normalizes reasoning_content to text for reasoning parts', () => {
    const part = reasoningPart({ text: 'think' });
    const result = mergeDeltaWithFallback(part, 'reasoning_content', 'ing');
    expect(result).not.toBeNull();
    expect((result as ReasoningPart).text).toBe('thinking');
  });

  it('normalizes reasoning_details to text for reasoning parts', () => {
    const part = reasoningPart({ text: '' });
    const result = mergeDeltaWithFallback(part, 'reasoning_details', 'detail');
    expect(result).not.toBeNull();
    expect((result as ReasoningPart).text).toBe('detail');
  });

  it('creates unknown fields via mergeDeltaIntoPart when no leaf conflict', () => {
    const part = textPart({ text: 'abc' });
    const result = mergeDeltaWithFallback(part, 'nonexistent.nested.field', 'xyz');
    expect(result).not.toBeNull();
    expect((result as TextPart).text).toBe('abc');
    expect(
      (result as unknown as Record<string, { nested: { field: string; }; }>)['nonexistent'].nested.field,
    ).toBe('xyz');
  });

  it('falls back to appending to text when path hits numeric leaf on text part', () => {
    const part = { ...textPart({ text: 'abc' }), count: 42 } as unknown as Part;
    const result = mergeDeltaWithFallback(part, 'count', '1');
    expect(result).not.toBeNull();
    expect((result as unknown as { text: string }).text).toBe('abc1');
  });

  it('falls back to appending to text when path hits numeric leaf on reasoning part', () => {
    const part = { ...reasoningPart({ text: 'abc' }), count: 42 } as unknown as Part;
    const result = mergeDeltaWithFallback(part, 'count', 'x');
    expect(result).not.toBeNull();
    expect((result as unknown as { text: string }).text).toBe('abcx');
  });

  it('returns null for tool parts when path hits numeric leaf', () => {
    const part = { ...toolPart(), count: 42 } as unknown as Part;
    expect(mergeDeltaWithFallback(part, 'count', 'data')).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// applyPendingDeltas
// ---------------------------------------------------------------------------

describe('applyPendingDeltas', () => {
  it('returns original part when no deltas', () => {
    const part = textPart({ text: 'hello' });
    const { merged, remaining } = applyPendingDeltas(part, []);
    expect(merged).toBe(part);
    expect(remaining).toHaveLength(0);
  });

  it('applies all deltas in order', () => {
    const part = textPart({ text: '' });
    const deltas: PendingPartDelta[] = [
      { field: 'text', delta: 'hello' },
      { field: 'text', delta: ' ' },
      { field: 'text', delta: 'world' },
    ];
    const { merged, remaining } = applyPendingDeltas(part, deltas);
    expect((merged as TextPart).text).toBe('hello world');
    expect(remaining).toHaveLength(0);
  });

  it('collects unmergeable deltas in remaining', () => {
    const part = { ...toolPart(), num: 99 } as unknown as Part;
    const deltas: PendingPartDelta[] = [
      { field: 'num', delta: 'data' },
    ];
    const { remaining } = applyPendingDeltas(part, deltas);
    expect(remaining).toHaveLength(1);
  });

  it('applies some and buffers others for text parts', () => {
    const part = {
      ...textPart({ text: '' }),
      num: 0,
    } as unknown as Part;
    const deltas: PendingPartDelta[] = [
      { field: 'text', delta: 'ok' },
      { field: 'num', delta: '1' },
    ];
    const { merged, remaining } = applyPendingDeltas(part, deltas);
    expect((merged as unknown as Record<string, unknown>)['text']).toBe('ok1');
    expect(remaining).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// compactPendingDeltas
// ---------------------------------------------------------------------------

describe('compactPendingDeltas', () => {
  it('returns original when under limit', () => {
    const deltas: PendingPartDelta[] = [
      { field: 'text', delta: 'a' },
      { field: 'text', delta: 'b' },
    ];
    expect(compactPendingDeltas(deltas, 5)).toBe(deltas);
  });

  it('merges consecutive same-field deltas', () => {
    const deltas: PendingPartDelta[] = [
      { field: 'text', delta: 'a' },
      { field: 'text', delta: 'b' },
      { field: 'text', delta: 'c' },
      { field: 'other', delta: 'x' },
    ];
    const result = compactPendingDeltas(deltas, 3);
    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({ field: 'text', delta: 'abc' });
    expect(result[1]).toEqual({ field: 'other', delta: 'x' });
  });

  it('trims from the start after compaction if still over limit', () => {
    const deltas: PendingPartDelta[] = [
      { field: 'a', delta: '1' },
      { field: 'b', delta: '2' },
      { field: 'c', delta: '3' },
      { field: 'd', delta: '4' },
    ];
    const result = compactPendingDeltas(deltas, 2);
    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({ field: 'c', delta: '3' });
    expect(result[1]).toEqual({ field: 'd', delta: '4' });
  });

  it('preserves accumulated text through compaction', () => {
    const deltas: PendingPartDelta[] = Array.from({ length: 10 }, (_, i) => ({
      field: 'text',
      delta: String(i),
    }));
    const result = compactPendingDeltas(deltas, 3);
    expect(result).toHaveLength(1);
    expect(result[0].delta).toBe('0123456789');
  });
});
