/**
 * @license
 * Copyright 2026 cofy-x
 * SPDX-License-Identifier: Apache-2.0
 */
import { create } from 'zustand';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ViewerContentType = 'markdown' | 'code' | 'diff' | 'image';

/**
 * Panel modes:
 * - `desktop`  — VNC sandbox desktop
 * - `viewer`   — Rich content viewer (markdown, code, diff, image)
 * - `log`      — Debug API request/response log
 * - `opencode` — OpenCode web UI (iframe, fullscreen — hides chat)
 * - `terminal` — Web terminal (iframe, fullscreen — hides chat)
 */
export type RightPanelMode =
  | 'desktop'
  | 'viewer'
  | 'log'
  | 'opencode'
  | 'terminal';

export type PanelVisibility = 'collapsed' | 'expanded';

/** Modes that take over the full width, hiding the chat panel. */
export const FULLSCREEN_MODES: ReadonlySet<RightPanelMode> = new Set([
  'opencode',
  'terminal',
]);

export interface ViewerContent {
  /** The kind of content to render in the viewer. */
  type: ViewerContentType;
  /** Display title shown in the viewer toolbar. */
  title: string;
  /** Primary payload: markdown text, source code, diff text, or image URL. */
  data: string;
  /** Programming language identifier (used when type is 'code' or 'diff'). */
  language?: string;
  /** Arbitrary metadata associated with the content. */
  metadata?: Record<string, unknown>;
}

interface ViewerState {
  /** Which view the right panel is currently showing. */
  mode: RightPanelMode;
  /** Visibility of the right panel in split layout mode. */
  panelVisibility: PanelVisibility;
  /** The content being displayed in the viewer (null when showing desktop). */
  content: ViewerContent | null;
  /** Last non-fullscreen mode/visibility to restore after exiting fullscreen. */
  lastSplitState: {
    mode: 'desktop' | 'viewer';
    panelVisibility: PanelVisibility;
  };
}

interface ViewerActions {
  /** Switch the right panel mode explicitly. */
  setMode: (mode: RightPanelMode) => void;
  /** Expand right panel in split mode. */
  expandPanel: () => void;
  /** Collapse right panel in split mode. */
  collapsePanel: () => void;
  /** Toggle right panel visibility in split mode. */
  togglePanel: () => void;
  /** Open rich content in the viewer and switch to viewer mode. */
  openContent: (content: ViewerContent) => void;
  /** Return to the desktop (VNC) view. */
  switchToDesktop: () => void;
  /** Switch to the OpenCode web panel (fullscreen). */
  switchToOpencode: () => void;
  /** Switch to the web terminal panel (fullscreen). */
  switchToTerminal: () => void;
  /** Clear viewer content. */
  clearContent: () => void;
  /** Exit a fullscreen mode and restore previous split state. */
  exitFullscreen: () => void;
  /** Reset the store to its initial state. */
  reset: () => void;
}

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

const PANEL_VISIBILITY_STORAGE_KEY = 'deck-viewer-panel-visibility';

function loadPanelVisibility(): PanelVisibility {
  try {
    const saved = sessionStorage.getItem(PANEL_VISIBILITY_STORAGE_KEY);
    return saved === 'expanded' ? 'expanded' : 'collapsed';
  } catch {
    return 'collapsed';
  }
}

function savePanelVisibility(next: PanelVisibility) {
  try {
    sessionStorage.setItem(PANEL_VISIBILITY_STORAGE_KEY, next);
  } catch {
    // Ignore storage errors (e.g. privacy mode / unavailable storage)
  }
}

function createInitialState(): ViewerState {
  const panelVisibility = loadPanelVisibility();
  return {
    mode: 'viewer',
    panelVisibility,
    content: null,
    lastSplitState: {
      mode: 'viewer',
      panelVisibility,
    },
  };
}

const initialState: ViewerState = createInitialState();

function toPrimaryMode(
  mode: RightPanelMode,
  fallback: 'desktop' | 'viewer',
): 'desktop' | 'viewer' {
  if (mode === 'desktop' || mode === 'viewer') return mode;
  return fallback;
}

export const useViewerStore = create<ViewerState & ViewerActions>((set) => ({
  ...initialState,
  setMode: (mode) =>
    set((state) => {
      if (mode === 'opencode' || mode === 'terminal') {
        savePanelVisibility('expanded');
        return {
          mode,
          content: null,
          panelVisibility: 'expanded',
          lastSplitState: {
            mode: toPrimaryMode(state.mode, state.lastSplitState.mode),
            panelVisibility: FULLSCREEN_MODES.has(state.mode)
              ? state.lastSplitState.panelVisibility
              : state.panelVisibility,
          },
        };
      }

      savePanelVisibility('expanded');
      return {
        mode,
        panelVisibility: 'expanded',
      };
    }),
  expandPanel: () => {
    savePanelVisibility('expanded');
    set({ panelVisibility: 'expanded' });
  },
  collapsePanel: () =>
    set((state) => {
      if (FULLSCREEN_MODES.has(state.mode)) return state;
      savePanelVisibility('collapsed');
      return { panelVisibility: 'collapsed' };
    }),
  togglePanel: () =>
    set((state) => {
      if (FULLSCREEN_MODES.has(state.mode)) return state;
      const nextVisibility =
        state.panelVisibility === 'collapsed' ? 'expanded' : 'collapsed';
      savePanelVisibility(nextVisibility);
      return {
        panelVisibility: nextVisibility,
      };
    }),
  openContent: (content) => {
    savePanelVisibility('expanded');
    set({
      mode: 'viewer',
      panelVisibility: 'expanded',
      content,
    });
  },
  switchToDesktop: () => {
    savePanelVisibility('expanded');
    set({
      mode: 'desktop',
      panelVisibility: 'expanded',
      content: null,
    });
  },
  switchToOpencode: () =>
    set((state) => {
      savePanelVisibility('expanded');
      return {
        mode: 'opencode',
        panelVisibility: 'expanded',
        content: null,
        lastSplitState: {
          mode: toPrimaryMode(state.mode, state.lastSplitState.mode),
          panelVisibility: FULLSCREEN_MODES.has(state.mode)
            ? state.lastSplitState.panelVisibility
            : state.panelVisibility,
        },
      };
    }),
  switchToTerminal: () =>
    set((state) => {
      savePanelVisibility('expanded');
      return {
        mode: 'terminal',
        panelVisibility: 'expanded',
        content: null,
        lastSplitState: {
          mode: toPrimaryMode(state.mode, state.lastSplitState.mode),
          panelVisibility: FULLSCREEN_MODES.has(state.mode)
            ? state.lastSplitState.panelVisibility
            : state.panelVisibility,
        },
      };
    }),
  clearContent: () =>
    set((state) => {
      const nextVisibility =
        state.mode === 'viewer' ? 'collapsed' : state.panelVisibility;
      savePanelVisibility(nextVisibility);
      return {
        content: null,
        panelVisibility: nextVisibility,
      };
    }),
  exitFullscreen: () =>
    set((state) => {
      savePanelVisibility(state.lastSplitState.panelVisibility);
      return {
        mode: state.lastSplitState.mode,
        panelVisibility: state.lastSplitState.panelVisibility,
      };
    }),
  reset: () => set(createInitialState()),
}));
