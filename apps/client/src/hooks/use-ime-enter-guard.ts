/**
 * @license
 * Copyright 2026 cofy-x
 * SPDX-License-Identifier: Apache-2.0
 */
import { useCallback, useEffect, useRef } from 'react';
import type { KeyboardEvent } from 'react';

/**
 * Guard keyboard shortcuts while IME composition is active.
 * Includes a one-tick buffer after compositionend to avoid accidental submit.
 */
export function useImeEnterGuard() {
  const isComposingRef = useRef(false);
  const compositionJustEndedRef = useRef(false);
  const resetTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearResetTimer = useCallback(() => {
    if (resetTimerRef.current) {
      clearTimeout(resetTimerRef.current);
      resetTimerRef.current = null;
    }
  }, []);

  const onCompositionStart = useCallback(() => {
    clearResetTimer();
    isComposingRef.current = true;
    compositionJustEndedRef.current = false;
  }, [clearResetTimer]);

  const onCompositionEnd = useCallback(() => {
    isComposingRef.current = false;
    compositionJustEndedRef.current = true;
    clearResetTimer();
    resetTimerRef.current = setTimeout(() => {
      compositionJustEndedRef.current = false;
      resetTimerRef.current = null;
    }, 0);
  }, [clearResetTimer]);

  useEffect(() => () => clearResetTimer(), [clearResetTimer]);

  const shouldBlockKeyDown = useCallback(
    (e: KeyboardEvent<HTMLElement>) =>
      e.nativeEvent.isComposing ||
      isComposingRef.current ||
      compositionJustEndedRef.current ||
      e.key === 'Process',
    [],
  );

  return { onCompositionStart, onCompositionEnd, shouldBlockKeyDown };
}
