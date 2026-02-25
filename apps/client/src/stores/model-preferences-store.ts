/**
 * @license
 * Copyright 2026 cofy-x
 * SPDX-License-Identifier: Apache-2.0
 *
 * Model preferences store — persisted to localStorage.
 *
 * Mirrors the data model used by the official OpenCode web UI:
 *
 * - `user`   — curated list of models the user has explicitly shown/hidden.
 *              Only models in this list with `visibility: "show"` AND whose
 *              provider is connected are displayed in the model selector.
 * - `recent` — ordered list of recently used models (most recent first).
 *              `recent[0]` is the currently active model; restored on reload.
 * - `variant`— model variant overrides (reserved for future use).
 */
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface UserModelEntry {
  providerID: string;
  modelID: string;
  visibility: 'show' | 'hide';
}

export interface RecentModelEntry {
  providerID: string;
  modelID: string;
}

interface ModelPreferencesState {
  user: UserModelEntry[];
  recent: RecentModelEntry[];
  variant: Record<string, string>;
}

interface ModelPreferencesActions {
  /**
   * Select a model as the active model.
   * - Moves/adds it to the front of `recent`.
   * - Ensures it is in `user` with `visibility: "show"`.
   */
  selectModel: (providerID: string, modelID: string) => void;

  /**
   * Set a model's visibility in the `user` list.
   * Adds the model to `user` if not already present.
   */
  setModelVisibility: (
    providerID: string,
    modelID: string,
    visibility: 'show' | 'hide',
  ) => void;

  /** Check whether a model is in the `user` list with `visibility: "show"`. */
  isModelVisible: (providerID: string, modelID: string) => boolean;

  /** Returns true if the user has curated any models. */
  hasUserModels: () => boolean;

  /**
   * Convenience: return the composite key "providerID/modelID" for `recent[0]`,
   * or `undefined` if there is no recent model.
   */
  getActiveModelKey: () => string | undefined;

  reset: () => void;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const MAX_RECENT = 10;

function matchesEntry(
  a: { providerID: string; modelID: string },
  b: { providerID: string; modelID: string },
): boolean {
  return a.providerID === b.providerID && a.modelID === b.modelID;
}

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

const initialState: ModelPreferencesState = {
  user: [],
  recent: [],
  variant: {},
};

export const useModelPreferencesStore = create<
  ModelPreferencesState & ModelPreferencesActions
>()(
  persist(
    (set, get) => ({
      ...initialState,

      selectModel: (providerID, modelID) =>
        set((state) => {
          const entry = { providerID, modelID };

          // Update recent: move to front, deduplicate, cap length
          const filteredRecent = state.recent.filter(
            (r) => !matchesEntry(r, entry),
          );
          const nextRecent = [entry, ...filteredRecent].slice(0, MAX_RECENT);

          // Ensure model is in user list with visibility "show"
          const existingIdx = state.user.findIndex((u) =>
            matchesEntry(u, entry),
          );
          let nextUser = [...state.user];
          if (existingIdx >= 0) {
            // Already in user list — ensure "show"
            nextUser[existingIdx] = {
              ...nextUser[existingIdx],
              visibility: 'show',
            };
          } else {
            // Not in user list — add with "show"
            nextUser = [
              ...nextUser,
              { providerID, modelID, visibility: 'show' },
            ];
          }

          return { recent: nextRecent, user: nextUser };
        }),

      setModelVisibility: (providerID, modelID, visibility) =>
        set((state) => {
          const existingIdx = state.user.findIndex((u) =>
            matchesEntry(u, { providerID, modelID }),
          );
          const nextUser = [...state.user];
          if (existingIdx >= 0) {
            nextUser[existingIdx] = { ...nextUser[existingIdx], visibility };
          } else {
            nextUser.push({ providerID, modelID, visibility });
          }
          return { user: nextUser };
        }),

      isModelVisible: (providerID, modelID) => {
        const entry = get().user.find((u) =>
          matchesEntry(u, { providerID, modelID }),
        );
        // If not in user list, not visible (unless user has no curated models)
        return entry?.visibility === 'show';
      },

      hasUserModels: () => get().user.length > 0,

      getActiveModelKey: () => {
        const first = get().recent[0];
        if (!first) return undefined;
        return `${first.providerID}/${first.modelID}`;
      },

      reset: () => set(initialState),
    }),
    {
      name: 'deck-model-preferences',
    },
  ),
);
