/**
 * @license
 * Copyright 2026 cofy-x
 * SPDX-License-Identifier: Apache-2.0
 */
import { create } from 'zustand';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ConfigUiState {
  /** Whether the settings sheet is open. */
  settingsOpen: boolean;
}

interface ConfigUiActions {
  openSettings: () => void;
  closeSettings: () => void;
  toggleSettings: () => void;
  reset: () => void;
}

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

const initialState: ConfigUiState = {
  settingsOpen: false,
};

export const useConfigStore = create<ConfigUiState & ConfigUiActions>(
  (set) => ({
    ...initialState,
    openSettings: () => set({ settingsOpen: true }),
    closeSettings: () => set({ settingsOpen: false }),
    toggleSettings: () =>
      set((state) => ({
        settingsOpen: !state.settingsOpen,
      })),
    reset: () => set(initialState),
  }),
);
