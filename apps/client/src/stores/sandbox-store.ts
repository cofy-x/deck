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

interface SandboxState {
  /** Current lifecycle status of the sandbox container. */
  status: SandboxStatusValue;
  /** Error message when status is 'error'. */
  errorMessage: string | null;
  /** Whether Docker is available on the host. */
  dockerAvailable: boolean | null;
  /** Whether a mutation (start/stop) is currently in progress. */
  isMutating: boolean;
}

interface SandboxActions {
  setStatus: (status: SandboxStatusValue) => void;
  setError: (message: string) => void;
  setDockerAvailable: (available: boolean) => void;
  setMutating: (isMutating: boolean) => void;
  reset: () => void;
}

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

const initialState: SandboxState = {
  status: 'idle',
  errorMessage: null,
  dockerAvailable: null,
  isMutating: false,
};

export const useSandboxStore = create<SandboxState & SandboxActions>((set) => ({
  ...initialState,
  setStatus: (status) => set({ status, errorMessage: null }),
  setError: (message) => set({ status: 'error', errorMessage: message }),
  setDockerAvailable: (available) => set({ dockerAvailable: available }),
  setMutating: (isMutating) => set({ isMutating }),
  reset: () => set(initialState),
}));
