/**
 * @license
 * Copyright 2026 cofy-x
 * SPDX-License-Identifier: Apache-2.0
 */
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type LogCategory = 'api' | 'sse' | 'error' | 'system';

export const ALL_LOG_CATEGORIES: LogCategory[] = [
  'api',
  'sse',
  'error',
  'system',
];

export interface DebugLogEntry {
  id: string;
  timestamp: number;
  method: string;
  url: string;
  category: LogCategory;
  /** One-line summary shown in collapsed list rows. */
  summary?: string;
  requestBody?: string;
  status?: number;
  durationMs?: number;
  responseBody?: string;
  error?: string;
}

interface DebugState {
  /** Whether debug mode (and the Log tab) is enabled. */
  enabled: boolean;
  /** Whether log collection is paused (entries are discarded while paused). */
  paused: boolean;
  /** Circular buffer of recent API log entries. */
  entries: DebugLogEntry[];
  /** IDs of pinned entries (pinned entries appear at the top). */
  pinnedIds: Set<string>;
  /** Active category filters (only entries matching a filter are shown). */
  activeFilters: Set<LogCategory>;
}

interface DebugActions {
  setEnabled: (enabled: boolean) => void;
  setPaused: (paused: boolean) => void;
  addEntry: (entry: DebugLogEntry) => void;
  togglePin: (id: string) => void;
  toggleFilter: (category: LogCategory) => void;
  clearEntries: () => void;
  reset: () => void;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Maximum number of entries to keep in memory. */
const MAX_ENTRIES = 200;

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

const initialState: DebugState = {
  enabled: false,
  paused: false,
  entries: [],
  pinnedIds: new Set(),
  activeFilters: new Set(ALL_LOG_CATEGORIES),
};

export const useDebugStore = create<DebugState & DebugActions>()(
  persist(
    (set) => ({
      ...initialState,
      setEnabled: (enabled) => set({ enabled }),
      setPaused: (paused) => set({ paused }),
      addEntry: (entry) =>
        set((state) => {
          if (!state.enabled || state.paused) return state;
          const updated = [...state.entries, entry].slice(-MAX_ENTRIES);
          return { entries: updated };
        }),
      togglePin: (id) =>
        set((state) => {
          const next = new Set(state.pinnedIds);
          if (next.has(id)) {
            next.delete(id);
          } else {
            next.add(id);
          }
          return { pinnedIds: next };
        }),
      toggleFilter: (category) =>
        set((state) => {
          const next = new Set(state.activeFilters);
          if (next.has(category)) {
            next.delete(category);
          } else {
            next.add(category);
          }
          return { activeFilters: next };
        }),
      clearEntries: () => set({ entries: [], pinnedIds: new Set() }),
      reset: () => set(initialState),
    }),
    {
      name: 'deck-debug-settings',
      partialize: (state) => ({ enabled: state.enabled }),
    },
  ),
);
