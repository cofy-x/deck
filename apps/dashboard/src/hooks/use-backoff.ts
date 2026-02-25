/**
 * @license
 * Copyright 2026 cofy-x
 * SPDX-License-Identifier: Apache-2.0
 */

import { useCallback, useRef, useState } from 'react';
import { createBackoff, type BackoffOptions } from '@/lib/backoff';

export function useBackoff(options: BackoffOptions = {}) {
  const backoffRef = useRef(createBackoff(options));
  const [attempt, setAttempt] = useState(0);

  const nextDelay = useCallback(() => {
    const delay = backoffRef.current.nextDelay();
    setAttempt((prev) => prev + 1);
    return delay;
  }, []);

  const reset = useCallback(() => {
    backoffRef.current.reset();
    setAttempt(0);
  }, []);

  return {
    nextDelay,
    reset,
    attempt,
    isRetrying: attempt > 0,
  };
}
