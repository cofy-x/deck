/**
 * @license
 * Copyright 2026 cofy-x
 * SPDX-License-Identifier: Apache-2.0
 */

export interface TelegramPartMeta {
  messageID: string;
  partType: string;
  ignored: boolean;
}

export interface TelegramPendingDelta {
  messageID: string;
  delta: string;
}

export interface TelegramTextStreamState {
  messageId?: number;
  text: string;
  parts: Map<string, string>;
  partOrder: string[];
  pending: boolean;
  timer: ReturnType<typeof setTimeout> | null;
  disabled: boolean;
  partMeta: Map<string, TelegramPartMeta>;
  pendingPartDeltas: Map<string, TelegramPendingDelta[]>;
  messageParts: Map<string, Set<string>>;
}

export type ResolveRoleFn = (
  sessionID: string,
  messageID: string,
) => string | undefined;

function isStrictShorterPrefix(previous: string, next: string): boolean {
  return previous.length > next.length && previous.startsWith(next);
}

export function mergeTextPreferNonRegressing(previous: string, next: string): string {
  if (isStrictShorterPrefix(previous, next)) {
    return previous;
  }
  return next;
}

export class TelegramStreamStateStore {
  private readonly states = new Map<string, TelegramTextStreamState>();

  get(sessionID: string): TelegramTextStreamState | undefined {
    return this.states.get(sessionID);
  }

  ensure(sessionID: string): TelegramTextStreamState {
    const existing = this.states.get(sessionID);
    if (existing) return existing;

    const next: TelegramTextStreamState = {
      text: '',
      parts: new Map<string, string>(),
      partOrder: [],
      pending: false,
      timer: null,
      disabled: false,
      partMeta: new Map<string, TelegramPartMeta>(),
      pendingPartDeltas: new Map<string, TelegramPendingDelta[]>(),
      messageParts: new Map<string, Set<string>>(),
    };
    this.states.set(sessionID, next);
    return next;
  }

  clearSession(sessionID: string): void {
    this.states.delete(sessionID);
  }

  clearPartState(state: TelegramTextStreamState, partID: string): void {
    state.pendingPartDeltas.delete(partID);
    state.partMeta.delete(partID);
    this.removePartFromMessageState(state, partID);
    this.removePartFromRenderState(state, partID);
  }

  rememberPartMessage(
    state: TelegramTextStreamState,
    partID: string,
    messageID: string,
  ): void {
    for (const [existingMessageID, partIDs] of state.messageParts.entries()) {
      if (!partIDs.has(partID)) continue;
      if (existingMessageID === messageID) return;
      partIDs.delete(partID);
      if (partIDs.size === 0) {
        state.messageParts.delete(existingMessageID);
      }
      break;
    }

    const partIDs = state.messageParts.get(messageID) ?? new Set<string>();
    partIDs.add(partID);
    state.messageParts.set(messageID, partIDs);
  }

  applyPendingDeltasIfEligible(
    sessionID: string,
    state: TelegramTextStreamState,
    partID: string,
    resolveRole: ResolveRoleFn,
  ): boolean {
    const meta = state.partMeta.get(partID);
    if (!meta || !this.isStreamableTextPart(meta)) {
      state.pendingPartDeltas.delete(partID);
      return false;
    }

    const role = resolveRole(sessionID, meta.messageID);
    if (role && role !== 'assistant') {
      state.pendingPartDeltas.delete(partID);
      return false;
    }
    if (role !== 'assistant') return false;

    const queue = state.pendingPartDeltas.get(partID);
    if (!queue || queue.length === 0) return false;

    if (!state.parts.has(partID)) {
      state.partOrder.push(partID);
    }
    let nextText = state.parts.get(partID) ?? '';
    for (const item of queue) {
      if (item.messageID !== meta.messageID) continue;
      nextText = `${nextText}${item.delta}`;
    }
    state.parts.set(partID, nextText);
    state.pendingPartDeltas.delete(partID);
    this.recomputeStreamText(state);
    return true;
  }

  onRoleResolved(
    sessionID: string,
    messageID: string,
    role: string,
    resolveRole: ResolveRoleFn,
  ): boolean {
    const state = this.states.get(sessionID);
    if (!state) return false;

    const partIDs = state.messageParts.get(messageID);
    if (!partIDs || partIDs.size === 0) return false;

    if (role !== 'assistant') {
      for (const partID of partIDs) {
        state.pendingPartDeltas.delete(partID);
        this.removePartFromRenderState(state, partID);
      }
      return false;
    }

    let shouldFlush = false;
    for (const partID of partIDs) {
      const meta = state.partMeta.get(partID);
      if (!meta || !this.isStreamableTextPart(meta)) {
        state.pendingPartDeltas.delete(partID);
        continue;
      }
      if ((state.parts.get(partID) ?? '').trim()) {
        shouldFlush = true;
      }
      if (this.applyPendingDeltasIfEligible(sessionID, state, partID, resolveRole)) {
        shouldFlush = true;
      }
    }

    if (shouldFlush) {
      state.pending = true;
    }
    return shouldFlush;
  }

  removePartFromRenderState(
    state: TelegramTextStreamState,
    partID: string,
  ): void {
    state.parts.delete(partID);
    state.partOrder = state.partOrder.filter((id) => id !== partID);
    this.recomputeStreamText(state);
  }

  recomputeStreamText(state: TelegramTextStreamState): void {
    state.text = state.partOrder.map((id) => state.parts.get(id) ?? '').join('\n');
  }

  private isStreamableTextPart(meta: TelegramPartMeta): boolean {
    return meta.partType === 'text' && !meta.ignored;
  }

  private removePartFromMessageState(
    state: TelegramTextStreamState,
    partID: string,
  ): void {
    for (const [messageID, partIDs] of state.messageParts.entries()) {
      if (!partIDs.delete(partID)) continue;
      if (partIDs.size === 0) {
        state.messageParts.delete(messageID);
      }
      break;
    }
  }
}
