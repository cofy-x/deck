/**
 * @license
 * Copyright 2026 cofy-x
 * SPDX-License-Identifier: Apache-2.0
 */
import { create } from 'zustand';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type SandboxStatusValue =
  | 'idle'
  | 'checking'
  | 'connecting'
  | 'pulling'
  | 'starting'
  | 'running'
  | 'stopping'
  | 'error';

export interface PullLogLayer {
  id: string;
  status: string;
}

interface SandboxState {
  /** Current lifecycle status of the sandbox container. */
  status: SandboxStatusValue;
  /** Error message when status is 'error'. */
  errorMessage: string | null;
  /** Whether Docker is available on the host. */
  dockerAvailable: boolean | null;
  /** Whether a mutation (start/stop) is currently in progress. */
  isMutating: boolean;
  /** Pull progress percentage (0-100), null when not pulling. */
  pullPercent: number | null;
  /** Pull progress status message from Docker. */
  pullMessage: string | null;
  /** Number of completed layers during pull. */
  pullLayersDone: number;
  /** Total number of discovered layers during pull. */
  pullLayersTotal: number;
  /** Per-layer status entries (insertion-ordered, updated in-place). */
  pullLogLayers: PullLogLayer[];
  /** Non-layer info lines (header, digest, status messages). */
  pullLogInfoLines: string[];
}

interface SandboxActions {
  setStatus: (status: SandboxStatusValue) => void;
  setError: (message: string) => void;
  setDockerAvailable: (available: boolean) => void;
  setMutating: (isMutating: boolean) => void;
  setPullProgress: (percent: number, message: string, layersDone: number, layersTotal: number) => void;
  updatePullLog: (message: string) => void;
  clearPullProgress: () => void;
  reset: () => void;
}

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

const LAYER_ID_RE = /^([0-9a-f]{6,12}):\s+(.+)$/i;

const initialState: SandboxState = {
  status: 'idle',
  errorMessage: null,
  dockerAvailable: null,
  isMutating: false,
  pullPercent: null,
  pullMessage: null,
  pullLayersDone: 0,
  pullLayersTotal: 0,
  pullLogLayers: [],
  pullLogInfoLines: [],
};

export const useSandboxStore = create<SandboxState & SandboxActions>((set) => ({
  ...initialState,
  setStatus: (status) => set({ status, errorMessage: null }),
  setError: (message) => set({ status: 'error', errorMessage: message }),
  setDockerAvailable: (available) => set({ dockerAvailable: available }),
  setMutating: (isMutating) => set({ isMutating }),
  setPullProgress: (percent, message, layersDone, layersTotal) =>
    set({ pullPercent: percent, pullMessage: message, pullLayersDone: layersDone, pullLayersTotal: layersTotal }),
  updatePullLog: (message) =>
    set((state) => {
      const match = LAYER_ID_RE.exec(message);
      if (match) {
        const layerId = match[1];
        const status = match[2];
        const idx = state.pullLogLayers.findIndex((l) => l.id === layerId);
        if (idx >= 0) {
          const updated = [...state.pullLogLayers];
          updated[idx] = { id: layerId, status };
          return { pullLogLayers: updated };
        }
        return {
          pullLogLayers: [...state.pullLogLayers, { id: layerId, status }],
        };
      }
      return { pullLogInfoLines: [...state.pullLogInfoLines, message] };
    }),
  clearPullProgress: () =>
    set({
      pullPercent: null,
      pullMessage: null,
      pullLayersDone: 0,
      pullLayersTotal: 0,
      pullLogLayers: [],
      pullLogInfoLines: [],
    }),
  reset: () => set(initialState),
}));
