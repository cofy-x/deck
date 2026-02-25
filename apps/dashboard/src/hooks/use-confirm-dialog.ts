/**
 * @license
 * Copyright 2025 cofy-x
 * SPDX-License-Identifier: Apache-2.0
 */

import { useCallback, useState } from 'react';

interface ConfirmDialogConfig {
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'default' | 'destructive';
  onConfirm: () => void | Promise<void>;
  onCancel?: () => void;
}

interface UseConfirmDialogReturn {
  isOpen: boolean;
  config: ConfirmDialogConfig | null;
  isLoading: boolean;
  open: (config: ConfirmDialogConfig) => void;
  close: () => void;
  confirm: () => Promise<void>;
  cancel: () => void;
}

export function useConfirmDialog(): UseConfirmDialogReturn {
  const [isOpen, setIsOpen] = useState(false);
  const [config, setConfig] = useState<ConfirmDialogConfig | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const open = useCallback((newConfig: ConfirmDialogConfig) => {
    setConfig(newConfig);
    setIsOpen(true);
    setIsLoading(false);
  }, []);

  const close = useCallback(() => {
    setIsOpen(false);
    setIsLoading(false);
    // Delay clearing config to allow animation to complete
    setTimeout(() => setConfig(null), 200);
  }, []);

  const confirm = useCallback(async () => {
    if (!config) return;

    setIsLoading(true);
    try {
      await config.onConfirm();
      close();
    } catch (error) {
      setIsLoading(false);
      throw error;
    }
  }, [config, close]);

  const cancel = useCallback(() => {
    config?.onCancel?.();
    close();
  }, [config, close]);

  return {
    isOpen,
    config,
    isLoading,
    open,
    close,
    confirm,
    cancel,
  };
}
