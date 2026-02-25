/**
 * @license
 * Copyright 2026 cofy-x
 * SPDX-License-Identifier: Apache-2.0
 */

export interface BackoffOptions {
  baseMs?: number;
  maxMs?: number;
  factor?: number;
  jitter?: number;
}

export function createBackoff(options: BackoffOptions = {}) {
  const baseMs = options.baseMs ?? 1000;
  const maxMs = options.maxMs ?? 15000;
  const factor = options.factor ?? 2;
  const jitter = options.jitter ?? 0.2;
  let attempt = 0;

  const nextDelay = () => {
    const expDelay = Math.min(maxMs, baseMs * Math.pow(factor, attempt));
    attempt += 1;
    if (jitter <= 0) return Math.round(expDelay);
    const spread = expDelay * jitter;
    const delta = (Math.random() * 2 - 1) * spread;
    return Math.max(0, Math.round(expDelay + delta));
  };

  const reset = () => {
    attempt = 0;
  };

  return { nextDelay, reset };
}
