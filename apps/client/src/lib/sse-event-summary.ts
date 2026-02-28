/**
 * @license
 * Copyright 2026 cofy-x
 * SPDX-License-Identifier: Apache-2.0
 */
import type { Event, Part } from '@opencode-ai/sdk/v2/client';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface SseEventDigest {
  type: string;
  sessionID?: string;
  messageID?: string;
  partID?: string;
  partType?: string;
  textLength?: number;
  hasEnd?: boolean;
  field?: string;
  deltaLength?: number;
  status?: string;
  error?: string;
}

// ---------------------------------------------------------------------------
// Loggable check
// ---------------------------------------------------------------------------

const SSE_LOGGABLE_TYPES = new Set<string>([
  'message.updated',
  'session.status',
  'session.idle',
  'session.compacted',
  'session.error',
]);

export function shouldLogSseEvent(event: Event): boolean {
  return SSE_LOGGABLE_TYPES.has(event.type);
}

// ---------------------------------------------------------------------------
// Digest extraction (single source of truth)
// ---------------------------------------------------------------------------

function extractPartTextLength(part: Part): number | undefined {
  return 'text' in part && typeof part.text === 'string'
    ? part.text.length
    : undefined;
}

function extractPartHasEnd(part: Part): boolean {
  return (
    'time' in part &&
    !!part.time &&
    typeof part.time === 'object' &&
    'end' in part.time &&
    part.time.end !== undefined
  );
}

function extractDigest(event: Event): SseEventDigest {
  switch (event.type) {
    case 'message.updated':
      return {
        type: event.type,
        sessionID: event.properties.info.sessionID,
        messageID: event.properties.info.id,
      };
    case 'message.part.updated': {
      const part = event.properties.part;
      const textLength = extractPartTextLength(part);
      const hasEnd = extractPartHasEnd(part);
      return {
        type: event.type,
        sessionID: part.sessionID,
        messageID: part.messageID,
        partID: part.id,
        partType: part.type,
        ...(textLength !== undefined ? { textLength } : {}),
        ...(hasEnd ? { hasEnd } : {}),
      };
    }
    case 'message.part.delta':
      return {
        type: event.type,
        sessionID: event.properties.sessionID,
        messageID: event.properties.messageID,
        partID: event.properties.partID,
        field: event.properties.field,
        deltaLength: event.properties.delta.length,
      };
    case 'session.status':
      return {
        type: event.type,
        sessionID: event.properties.sessionID,
        status: event.properties.status.type,
      };
    case 'session.idle':
      return {
        type: event.type,
        sessionID: event.properties.sessionID,
      };
    case 'session.compacted':
      return {
        type: event.type,
        sessionID: event.properties.sessionID,
      };
    case 'session.error':
      return {
        type: event.type,
        sessionID: event.properties.sessionID,
        error: event.properties.error?.name,
      };
    default:
      return { type: event.type };
  }
}

// ---------------------------------------------------------------------------
// Public formatters
// ---------------------------------------------------------------------------

export function summarizeSseEventJson(event: Event): string {
  return JSON.stringify(extractDigest(event));
}

export function summarizeSseEventCompact(event: Event): string {
  const d = extractDigest(event);
  switch (event.type) {
    case 'message.updated':
      return `message.updated msg=${d.messageID}`;
    case 'message.part.updated': {
      const lenTag = d.textLength !== undefined ? ` len=${d.textLength}` : '';
      const endTag = d.hasEnd ? ' end=1' : '';
      return `message.part.updated ${d.partType} part=${d.partID}${lenTag}${endTag}`;
    }
    case 'message.part.delta':
      return `message.part.delta part=${d.partID} field=${d.field} delta=${d.deltaLength}`;
    case 'session.status':
      return `session.status ${d.status} session=${d.sessionID}`;
    case 'session.idle':
      return `session.idle session=${d.sessionID}`;
    case 'session.compacted':
      return `session.compacted session=${d.sessionID}`;
    case 'session.error':
      return `session.error ${d.error ?? 'UnknownError'} session=${d.sessionID ?? 'n/a'}`;
    default:
      return d.type;
  }
}
