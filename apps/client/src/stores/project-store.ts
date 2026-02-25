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

interface ProjectState {
  /** The currently active project directory (inside the sandbox). */
  currentDirectory: string | null;
  /** Whether the project picker dialog is open. */
  projectPickerOpen: boolean;
}

interface ProjectActions {
  setDirectory: (directory: string | null) => void;
  openProjectPicker: () => void;
  closeProjectPicker: () => void;
  reset: () => void;
}

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

const initialState: ProjectState = {
  currentDirectory: null,
  projectPickerOpen: false,
};

export const useProjectStore = create<ProjectState & ProjectActions>()(
  persist(
    (set) => ({
      ...initialState,
      setDirectory: (directory) =>
        set({ currentDirectory: directory, projectPickerOpen: false }),
      openProjectPicker: () => set({ projectPickerOpen: true }),
      closeProjectPicker: () => set({ projectPickerOpen: false }),
      reset: () => set(initialState),
    }),
    {
      name: 'deck-project',
      // Only persist the directory, not the ephemeral dialog state
      partialize: (state) => ({ currentDirectory: state.currentDirectory }),
    },
  ),
);
