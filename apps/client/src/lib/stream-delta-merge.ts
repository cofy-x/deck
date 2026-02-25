/**
 * @license
 * Copyright 2026 cofy-x
 * SPDX-License-Identifier: Apache-2.0
 */
import type { Part, SessionMessagesResponse } from '@opencode-ai/sdk/v2/client';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type MessageWithParts = SessionMessagesResponse[number];
export type PendingPartDelta = { field: string; delta: string };
type StreamTextPart = Extract<Part, { type: 'text' | 'reasoning' }>;

// ---------------------------------------------------------------------------
// Shallow clone
// ---------------------------------------------------------------------------

function shallowClone(value: unknown): unknown {
  if (Array.isArray(value)) return [...value];
  if (value && typeof value === 'object') {
    return { ...(value as Record<string, unknown>) };
  }
  return value;
}

// ---------------------------------------------------------------------------
// Part-level helpers
// ---------------------------------------------------------------------------

export function isStreamTextPart(part: Part): part is StreamTextPart {
  return part.type === 'text' || part.type === 'reasoning';
}

/**
 * Prevent text regression during streaming: when the incoming snapshot is a
 * strict shorter prefix of the previous text, keep the longer version.
 */
export function mergePartPreferNonRegressingText(
  previousPart: Part | undefined,
  nextPart: Part,
): Part {
  if (!previousPart) return nextPart;
  if (previousPart.id !== nextPart.id) return nextPart;
  if (previousPart.type !== nextPart.type) return nextPart;
  if (!isStreamTextPart(previousPart) || !isStreamTextPart(nextPart)) {
    return nextPart;
  }

  const previousText = previousPart.text ?? '';
  const nextText = nextPart.text ?? '';
  const isShorterPrefix =
    previousText.length > nextText.length && previousText.startsWith(nextText);
  if (!isShorterPrefix) return nextPart;

  return {
    ...nextPart,
    text: previousText,
  };
}

/**
 * Apply anti-regression merging across an entire messages array.
 */
export function mergeMessagesPreferNonRegressingText(
  previousMessages: MessageWithParts[] | undefined,
  nextMessages: MessageWithParts[],
): MessageWithParts[] {
  if (!previousMessages || previousMessages.length === 0) return nextMessages;
  if (nextMessages.length === 0) return nextMessages;

  const previousByMessageId = new Map(
    previousMessages.map((message) => [message.info.id, message]),
  );

  return nextMessages.map((message) => {
    const previousMessage = previousByMessageId.get(message.info.id);
    if (!previousMessage || previousMessage.parts.length === 0) return message;

    const previousPartById = new Map(
      previousMessage.parts.map((part) => [part.id, part]),
    );

    const mergedParts = message.parts.map((part) =>
      mergePartPreferNonRegressingText(previousPartById.get(part.id), part),
    );

    return {
      ...message,
      parts: mergedParts,
    };
  });
}

// ---------------------------------------------------------------------------
// Path-based delta merging
// ---------------------------------------------------------------------------

/**
 * Apply a string delta to a nested field inside a Part, identified by a
 * dot-separated path (e.g. `"text"`, `"state.output"`). Returns a new Part
 * with the delta appended, or `null` when the path can't be resolved.
 */
export function mergeDeltaIntoPart(
  part: Part,
  field: string,
  delta: string,
): Part | null {
  if (!field || !delta) return null;
  const segments = field.split('.').filter(Boolean);
  if (segments.length === 0) return null;

  const root = shallowClone(part);
  if (!root || typeof root !== 'object') return null;

  let cursor = root as Record<string, unknown>;
  for (let index = 0; index < segments.length - 1; index += 1) {
    const key = segments[index];
    const next = cursor[key];
    if (next === undefined) {
      const created: Record<string, unknown> = {};
      cursor[key] = created;
      cursor = created;
      continue;
    }
    if (!next || typeof next !== 'object') return null;
    const cloned = shallowClone(next);
    if (!cloned || typeof cloned !== 'object') return null;
    cursor[key] = cloned;
    cursor = cloned as Record<string, unknown>;
  }

  const leaf = segments[segments.length - 1];
  const existing = cursor[leaf];
  if (existing === undefined) {
    cursor[leaf] = delta;
    return root as Part;
  }
  if (typeof existing !== 'string') return null;
  cursor[leaf] = existing + delta;
  return root as Part;
}

/**
 * Merge a delta into a Part with reasoning-field normalization and a fallback
 * that appends to `text` for text/reasoning parts.
 */
export function mergeDeltaWithFallback(
  part: Part,
  field: string,
  delta: string,
): Part | null {
  const normalizedField =
    part.type === 'reasoning' &&
    (field === 'reasoning_content' || field === 'reasoning_details')
      ? 'text'
      : field;
  const merged = mergeDeltaIntoPart(part, normalizedField, delta);
  if (merged) return merged;
  if (part.type === 'reasoning' || part.type === 'text') {
    const existingText = typeof part.text === 'string' ? part.text : '';
    return {
      ...part,
      text: `${existingText}${delta}`,
    };
  }
  return null;
}

/**
 * Apply all buffered deltas to a part, returning the merged result and any
 * remaining deltas that couldn't be applied.
 */
export function applyPendingDeltas(
  part: Part,
  pendingDeltas: PendingPartDelta[],
): { merged: Part; remaining: PendingPartDelta[] } {
  let mergedPart = part;
  const remaining: PendingPartDelta[] = [];

  for (const pendingDelta of pendingDeltas) {
    const result = mergeDeltaWithFallback(
      mergedPart,
      pendingDelta.field,
      pendingDelta.delta,
    );
    if (!result) {
      remaining.push(pendingDelta);
      continue;
    }
    mergedPart = result;
  }

  return { merged: mergedPart, remaining };
}

/**
 * Compact a pending-deltas buffer: concatenate consecutive deltas that target
 * the same field so accumulated text is preserved when the entry count is
 * trimmed to `maxEntries`.
 */
export function compactPendingDeltas(
  deltas: PendingPartDelta[],
  maxEntries: number,
): PendingPartDelta[] {
  if (deltas.length <= maxEntries) return deltas;

  const compacted: PendingPartDelta[] = [];
  for (const delta of deltas) {
    const last = compacted[compacted.length - 1];
    if (last && last.field === delta.field) {
      last.delta += delta.delta;
    } else {
      compacted.push({ field: delta.field, delta: delta.delta });
    }
  }

  if (compacted.length <= maxEntries) return compacted;
  return compacted.slice(compacted.length - maxEntries);
}
