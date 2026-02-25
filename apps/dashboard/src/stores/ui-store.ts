/**
 * @license
 * Copyright 2025 cofy-x
 * SPDX-License-Identifier: Apache-2.0
 */

import { create } from 'zustand';

import { persist } from 'zustand/middleware';

interface ConfirmDialogConfig {
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'default' | 'destructive';
  onConfirm: () => void | Promise<void>;
  onCancel?: () => void;
}

interface UIState {
  // Sidebar state
  sidebarCollapsed: boolean;
  toggleSidebar: () => void;
  setSidebarCollapsed: (collapsed: boolean) => void;

  // Confirm dialog state
  confirmDialog: ConfirmDialogConfig | null;
  confirmDialogOpen: boolean;
  confirmDialogLoading: boolean;
  openConfirmDialog: (config: ConfirmDialogConfig) => void;
  closeConfirmDialog: () => void;
  setConfirmDialogLoading: (loading: boolean) => void;

  // Theme
  theme: 'light' | 'dark' | 'system';
  setTheme: (theme: 'light' | 'dark' | 'system') => void;
}

export const useUIStore = create<UIState>()(
  persist(
    (set) => ({
      // Sidebar
      sidebarCollapsed: false,
      toggleSidebar: () =>
        set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),
      setSidebarCollapsed: (collapsed) => set({ sidebarCollapsed: collapsed }),

      // Confirm dialog
      confirmDialog: null,
      confirmDialogOpen: false,
      confirmDialogLoading: false,
      openConfirmDialog: (config) =>
        set({
          confirmDialog: config,
          confirmDialogOpen: true,
          confirmDialogLoading: false,
        }),
      closeConfirmDialog: () =>
        set({
          confirmDialogOpen: false,
          confirmDialogLoading: false,
        }),
      setConfirmDialogLoading: (loading) =>
        set({ confirmDialogLoading: loading }),

      // Theme
      theme: 'system',
      setTheme: (theme) => set({ theme }),
    }),
    {
      name: 'deck-ui-storage',
      partialize: (state) => ({
        sidebarCollapsed: state.sidebarCollapsed,
        theme: state.theme,
      }),
    },
  ),
);
