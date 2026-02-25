/**
 * @license
 * Copyright 2026 cofy-x
 * SPDX-License-Identifier: Apache-2.0
 */

import type {
  MessagePartDeltaProps,
  MessagePartStreamProps,
  TelegramRunState,
} from '../../../types/index.js';
import type { TelegramFlushEngine } from './flush-engine.js';
import type { ResolveRunOptions } from './guards.js';
import {
  mergeTextPreferNonRegressing,
  type ResolveRoleFn,
} from './stream-state-store.js';
import type { TelegramStreamStateStore } from './stream-state-store.js';

const FALLBACK_PART_ID = '__single_text_part__';

export interface TelegramPartHandlerDeps {
  resolveRun: (
    sessionID: string,
    options?: ResolveRunOptions,
  ) => TelegramRunState | null;
  resolveRole: ResolveRoleFn;
  stateStore: TelegramStreamStateStore;
  flushEngine: TelegramFlushEngine;
}

export async function handleTelegramMessagePartDelta(
  props: MessagePartDeltaProps | undefined,
  deps: TelegramPartHandlerDeps,
): Promise<void> {
  const sessionID = props?.sessionID;
  if (!sessionID) return;

  const run = deps.resolveRun(sessionID, { includeSuppressed: true });
  if (!run) return;

  const partID = props?.partID;
  if (run.telegram.streamingSuppressed) {
    const state = deps.stateStore.get(sessionID);
    if (state && partID) {
      deps.stateStore.clearPartState(state, partID);
    }
    return;
  }

  const messageID = props?.messageID;
  const field = props?.field;
  const delta = props?.delta;
  if (!messageID || !partID || field !== 'text' || !delta) return;

  const state = deps.stateStore.ensure(sessionID);
  const role = deps.resolveRole(sessionID, messageID);
  if (role && role !== 'assistant') {
    state.pendingPartDeltas.delete(partID);
    return;
  }

  const meta = state.partMeta.get(partID);
  if (meta && meta.messageID !== messageID) {
    state.partMeta.delete(partID);
    state.pendingPartDeltas.delete(partID);
    deps.stateStore.removePartFromRenderState(state, partID);
  }

  const nextMeta = state.partMeta.get(partID);
  if (nextMeta && (nextMeta.partType !== 'text' || nextMeta.ignored)) {
    state.pendingPartDeltas.delete(partID);
    return;
  }

  if (nextMeta && role === 'assistant') {
    if (!state.parts.has(partID)) {
      state.partOrder.push(partID);
    }
    const previousText = state.parts.get(partID) ?? '';
    state.parts.set(partID, `${previousText}${delta}`);
    deps.stateStore.recomputeStreamText(state);
    deps.flushEngine.markPending(sessionID);
    return;
  }

  const queue = state.pendingPartDeltas.get(partID) ?? [];
  queue.push({ messageID, delta });
  state.pendingPartDeltas.set(partID, queue);
}

export async function handleTelegramMessagePartUpdated(
  props: MessagePartStreamProps | undefined,
  deps: TelegramPartHandlerDeps,
): Promise<void> {
  const part = props?.part;
  if (!part?.sessionID) return;

  const run = deps.resolveRun(part.sessionID, {
    includeSuppressed: true,
  });
  if (!run) return;

  const partID =
    typeof part.id === 'string' && part.id.trim() ? part.id : FALLBACK_PART_ID;
  if (run.telegram.streamingSuppressed) {
    const state = deps.stateStore.get(part.sessionID);
    if (state) {
      deps.stateStore.clearPartState(state, partID);
    }
    return;
  }

  const messageID = part.messageID;
  if (!messageID) return;

  const delta = typeof props?.delta === 'string' ? props.delta : '';
  const state = deps.stateStore.ensure(part.sessionID);
  deps.stateStore.rememberPartMessage(state, partID, messageID);
  state.partMeta.set(partID, {
    messageID,
    partType: part.type,
    ignored: part.type === 'text' ? Boolean(part.ignored) : false,
  });

  if (part.type !== 'text' || part.ignored) {
    state.pendingPartDeltas.delete(partID);
    deps.stateStore.removePartFromRenderState(state, partID);
    return;
  }

  const role = deps.resolveRole(part.sessionID, messageID);
  if (role === undefined) {
    deps.stateStore.removePartFromRenderState(state, partID);
    return;
  }

  if (role !== 'assistant') {
    state.pendingPartDeltas.delete(partID);
    deps.stateStore.removePartFromRenderState(state, partID);
    return;
  }

  const textValue = typeof part.text === 'string' ? part.text : '';
  if (!state.parts.has(partID)) {
    state.partOrder.push(partID);
  }
  const previousText = state.parts.get(partID) ?? '';
  let nextText = mergeTextPreferNonRegressing(previousText, textValue);
  if (delta) {
    nextText = `${nextText}${delta}`;
  }
  state.parts.set(partID, nextText);
  deps.stateStore.recomputeStreamText(state);

  let shouldFlush = false;
  if ((state.parts.get(partID) ?? '').trim()) {
    shouldFlush = true;
  }
  if (delta) {
    shouldFlush = true;
  }
  if (
    deps.stateStore.applyPendingDeltasIfEligible(
      part.sessionID,
      state,
      partID,
      deps.resolveRole,
    )
  ) {
    shouldFlush = true;
  }

  if (role === 'assistant' && shouldFlush) {
    deps.flushEngine.markPending(part.sessionID);
  }
}
