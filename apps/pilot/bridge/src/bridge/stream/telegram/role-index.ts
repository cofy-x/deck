/**
 * @license
 * Copyright 2026 cofy-x
 * SPDX-License-Identifier: Apache-2.0
 */

interface SessionRoleState {
  roles: Map<string, string>;
  order: string[];
}

const DEFAULT_MAX_ROLE_ENTRIES = 64;

export class TelegramRoleIndex {
  private readonly roleStates = new Map<string, SessionRoleState>();

  private readonly maxRoleEntries: number;

  constructor(maxRoleEntries = DEFAULT_MAX_ROLE_ENTRIES) {
    this.maxRoleEntries = maxRoleEntries;
  }

  remember(sessionID: string, messageID: string, role: string): void {
    const state = this.ensure(sessionID);
    if (!state.roles.has(messageID)) {
      state.order.push(messageID);
    }
    state.roles.set(messageID, role);

    while (state.order.length > this.maxRoleEntries) {
      const removed = state.order.shift();
      if (!removed) break;
      state.roles.delete(removed);
    }
  }

  resolve(sessionID: string, messageID: string): string | undefined {
    return this.roleStates.get(sessionID)?.roles.get(messageID);
  }

  clearSession(sessionID: string): void {
    this.roleStates.delete(sessionID);
  }

  private ensure(sessionID: string): SessionRoleState {
    const existing = this.roleStates.get(sessionID);
    if (existing) return existing;

    const next: SessionRoleState = {
      roles: new Map<string, string>(),
      order: [],
    };
    this.roleStates.set(sessionID, next);
    return next;
  }
}
