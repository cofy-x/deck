/**
 * @license
 * Copyright 2026 cofy-x
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, expect, it } from 'vitest';
import type { Event, Part, TextPart } from '@opencode-ai/sdk/v2/client';

import {
  shouldLogSseEvent,
  summarizeSseEventJson,
  summarizeSseEventCompact,
} from './sse-event-summary';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function textPart(overrides: Partial<TextPart> = {}): Part {
  return {
    id: 'part-1',
    sessionID: 'sess-1',
    messageID: 'msg-1',
    type: 'text',
    text: '',
    ...overrides,
  };
}

function makeEvent<T extends Event['type']>(
  type: T,
  properties: Extract<Event, { type: T }>['properties'],
): Event {
  return { type, properties } as Event;
}

// ---------------------------------------------------------------------------
// shouldLogSseEvent
// ---------------------------------------------------------------------------

describe('shouldLogSseEvent', () => {
  const loggable: Array<Event['type']> = [
    'message.updated',
    'message.part.updated',
    'session.status',
    'session.idle',
    'session.compacted',
    'session.error',
  ];

  for (const type of loggable) {
    it(`returns true for ${type}`, () => {
      const event = { type, properties: {} } as unknown as Event;
      expect(shouldLogSseEvent(event)).toBe(true);
    });
  }

  const nonLoggable: Array<Event['type']> = [
    'message.part.delta',
    'message.removed',
    'message.part.removed',
    'session.created',
    'session.updated',
    'session.deleted',
    'permission.asked',
  ];

  for (const type of nonLoggable) {
    it(`returns false for ${type}`, () => {
      const event = { type, properties: {} } as unknown as Event;
      expect(shouldLogSseEvent(event)).toBe(false);
    });
  }
});

// ---------------------------------------------------------------------------
// summarizeSseEventJson
// ---------------------------------------------------------------------------

describe('summarizeSseEventJson', () => {
  it('serializes message.updated as JSON digest', () => {
    const event = makeEvent('message.updated', {
      info: {
        id: 'msg-1',
        sessionID: 'sess-1',
        role: 'assistant',
        time: { created: 1000 },
      },
    } as Extract<Event, { type: 'message.updated' }>['properties']);
    const parsed = JSON.parse(summarizeSseEventJson(event));
    expect(parsed.type).toBe('message.updated');
    expect(parsed.sessionID).toBe('sess-1');
    expect(parsed.messageID).toBe('msg-1');
  });

  it('serializes message.part.updated with textLength', () => {
    const event = makeEvent('message.part.updated', {
      part: textPart({ text: 'hello world' }),
    });
    const parsed = JSON.parse(summarizeSseEventJson(event));
    expect(parsed.type).toBe('message.part.updated');
    expect(parsed.textLength).toBe(11);
    expect(parsed.partType).toBe('text');
  });

  it('serializes message.part.delta with deltaLength', () => {
    const event = makeEvent('message.part.delta', {
      sessionID: 'sess-1',
      messageID: 'msg-1',
      partID: 'part-1',
      field: 'text',
      delta: 'chunk',
    });
    const parsed = JSON.parse(summarizeSseEventJson(event));
    expect(parsed.type).toBe('message.part.delta');
    expect(parsed.deltaLength).toBe(5);
    expect(parsed.field).toBe('text');
  });

  it('serializes session.status with status type', () => {
    const event = makeEvent('session.status', {
      sessionID: 'sess-1',
      status: { type: 'busy' },
    } as Extract<Event, { type: 'session.status' }>['properties']);
    const parsed = JSON.parse(summarizeSseEventJson(event));
    expect(parsed.type).toBe('session.status');
    expect(parsed.status).toBe('busy');
  });

  it('serializes session.idle', () => {
    const event = makeEvent('session.idle', { sessionID: 'sess-1' });
    const parsed = JSON.parse(summarizeSseEventJson(event));
    expect(parsed.type).toBe('session.idle');
    expect(parsed.sessionID).toBe('sess-1');
  });

  it('serializes session.compacted', () => {
    const event = makeEvent('session.compacted', { sessionID: 'sess-1' });
    const parsed = JSON.parse(summarizeSseEventJson(event));
    expect(parsed.type).toBe('session.compacted');
    expect(parsed.sessionID).toBe('sess-1');
  });

  it('serializes session.error', () => {
    const event = makeEvent('session.error', {
      sessionID: 'sess-1',
      error: { name: 'RateLimitError', message: 'Too many requests' },
    } as unknown as Extract<Event, { type: 'session.error' }>['properties']);
    const parsed = JSON.parse(summarizeSseEventJson(event));
    expect(parsed.type).toBe('session.error');
    expect(parsed.error).toBe('RateLimitError');
  });

  it('serializes unknown event type as type-only digest', () => {
    const event = { type: 'unknown.event', properties: {} } as unknown as Event;
    const parsed = JSON.parse(summarizeSseEventJson(event));
    expect(parsed).toEqual({ type: 'unknown.event' });
  });
});

// ---------------------------------------------------------------------------
// summarizeSseEventCompact
// ---------------------------------------------------------------------------

describe('summarizeSseEventCompact', () => {
  it('formats message.updated', () => {
    const event = makeEvent('message.updated', {
      info: {
        id: 'msg-42',
        sessionID: 'sess-1',
        role: 'assistant',
        time: { created: 1000 },
      },
    } as Extract<Event, { type: 'message.updated' }>['properties']);
    expect(summarizeSseEventCompact(event)).toBe('message.updated msg=msg-42');
  });

  it('formats message.part.updated with text length and no end', () => {
    const event = makeEvent('message.part.updated', {
      part: textPart({ id: 'p1', text: 'abc' }),
    });
    expect(summarizeSseEventCompact(event)).toBe(
      'message.part.updated text part=p1 len=3',
    );
  });

  it('formats message.part.updated with end marker', () => {
    const event = makeEvent('message.part.updated', {
      part: {
        ...textPart({ id: 'p1', text: 'done' }),
        time: { start: 100, end: 200 },
      } as TextPart,
    });
    expect(summarizeSseEventCompact(event)).toBe(
      'message.part.updated text part=p1 len=4 end=1',
    );
  });

  it('formats message.part.updated for non-text part without len', () => {
    const event = makeEvent('message.part.updated', {
      part: {
        id: 'p-tool',
        sessionID: 'sess-1',
        messageID: 'msg-1',
        type: 'tool',
        tool: 'shell',
        callID: 'call-1',
        state: { status: 'running', input: {} },
      } as Part,
    });
    const result = summarizeSseEventCompact(event);
    expect(result).toBe('message.part.updated tool part=p-tool');
    expect(result).not.toContain('len=');
  });

  it('formats message.part.delta', () => {
    const event = makeEvent('message.part.delta', {
      sessionID: 'sess-1',
      messageID: 'msg-1',
      partID: 'part-1',
      field: 'text',
      delta: 'hello',
    });
    expect(summarizeSseEventCompact(event)).toBe(
      'message.part.delta part=part-1 field=text delta=5',
    );
  });

  it('formats session.status', () => {
    const event = makeEvent('session.status', {
      sessionID: 'sess-1',
      status: { type: 'idle' },
    } as Extract<Event, { type: 'session.status' }>['properties']);
    expect(summarizeSseEventCompact(event)).toBe(
      'session.status idle session=sess-1',
    );
  });

  it('formats session.idle', () => {
    const event = makeEvent('session.idle', { sessionID: 'sess-1' });
    expect(summarizeSseEventCompact(event)).toBe('session.idle session=sess-1');
  });

  it('formats session.compacted', () => {
    const event = makeEvent('session.compacted', { sessionID: 'sess-1' });
    expect(summarizeSseEventCompact(event)).toBe(
      'session.compacted session=sess-1',
    );
  });

  it('formats session.error with error name', () => {
    const event = makeEvent('session.error', {
      sessionID: 'sess-1',
      error: { name: 'TimeoutError', message: 'timeout' },
    } as unknown as Extract<Event, { type: 'session.error' }>['properties']);
    expect(summarizeSseEventCompact(event)).toBe(
      'session.error TimeoutError session=sess-1',
    );
  });

  it('formats session.error with missing error name', () => {
    const event = makeEvent('session.error', {
      sessionID: 'sess-1',
      error: undefined,
    } as Extract<Event, { type: 'session.error' }>['properties']);
    expect(summarizeSseEventCompact(event)).toBe(
      'session.error UnknownError session=sess-1',
    );
  });

  it('formats unknown event type as type string', () => {
    const event = { type: 'custom.event', properties: {} } as unknown as Event;
    expect(summarizeSseEventCompact(event)).toBe('custom.event');
  });
});
