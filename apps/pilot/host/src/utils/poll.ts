/**
 * @license
 * Copyright 2026 cofy-x
 * SPDX-License-Identifier: Apache-2.0
 */

export interface PollOptions<TResult> {
  timeoutMs?: number;
  intervalMs?: number;
  timeoutMessage: string;
  attempt: () => Promise<TResult | null | undefined>;
}

export async function sleep(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

export async function pollUntil<TResult>(
  options: PollOptions<TResult>,
): Promise<TResult> {
  const timeoutMs = options.timeoutMs ?? 10_000;
  const intervalMs = options.intervalMs ?? 250;
  const startedAt = Date.now();
  let lastError: string | null = null;

  while (Date.now() - startedAt < timeoutMs) {
    try {
      const value = await options.attempt();
      if (value !== null && value !== undefined) {
        return value;
      }
      lastError = null;
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
    }
    await sleep(intervalMs);
  }

  throw new Error(lastError ?? options.timeoutMessage);
}
