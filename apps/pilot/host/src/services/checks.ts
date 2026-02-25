/**
 * @license
 * Copyright 2026 cofy-x
 * SPDX-License-Identifier: Apache-2.0
 */

import type { HttpHeaders, PilotWorkspacesResponse } from '../types/index.js';
import { fetchJson } from '../utils/http.js';
import type { OpencodeClient } from './health.js';

interface RunChecksInput {
  opencodeClient: OpencodeClient;
  pilotUrl: string;
  pilotToken: string;
  checkEvents: boolean;
}

export async function runChecks(input: RunChecksInput): Promise<void> {
  const headers: HttpHeaders = {
    Authorization: `Bearer ${input.pilotToken}`,
  };
  const workspaces = await fetchJson<PilotWorkspacesResponse>(
    `${input.pilotUrl}/workspaces`,
    { headers },
  );
  const items = workspaces.items ?? [];
  if (!items.length) {
    throw new Error('Pilot server returned no workspaces');
  }

  const firstWorkspace = items[0];
  if (!firstWorkspace?.id) {
    throw new Error('Pilot server returned workspace without id');
  }
  await fetchJson<object>(
    `${input.pilotUrl}/workspace/${firstWorkspace.id}/config`,
    { headers },
  );

  await input.opencodeClient.session.create({ title: 'Pilot host check' });

  if (input.checkEvents) {
    const controller = new AbortController();
    let eventCount = 0;

    const subscription = await input.opencodeClient.event.subscribe(undefined, {
      signal: controller.signal,
    });

    const reader = (async () => {
      try {
        for await (const _raw of subscription.stream) {
          eventCount++;
          if (eventCount >= 10) break;
        }
      } catch {
        // ignore
      }
    })();

    await input.opencodeClient.session.create({
      title: 'Pilot host check events',
    });
    await new Promise((resolve) => setTimeout(resolve, 1200));
    controller.abort();
    await Promise.race([
      reader,
      new Promise((resolve) => setTimeout(resolve, 500)),
    ]);

    if (eventCount === 0) {
      throw new Error('No SSE events observed during check');
    }
  }
}
