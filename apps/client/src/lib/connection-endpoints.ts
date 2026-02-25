/**
 * @license
 * Copyright 2026 cofy-x
 * SPDX-License-Identifier: Apache-2.0
 */
import type { ConnectionProfile } from '@/stores/connection-store';
import { PORTS } from '@/lib/constants';
import {
  normalizeHttpUrl,
  normalizeOptionalHttpUrl,
} from '@/lib/connection-validation';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ResolvedConnectionEndpoints {
  opencodeBaseUrl: string;
  daemonBaseUrl: string;
  noVncUrl: string;
  webTerminalUrl: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatHost(hostname: string): string {
  if (hostname.includes(':') && !hostname.startsWith('[')) {
    return `[${hostname}]`;
  }
  return hostname;
}

function deriveBaseUrl(opencodeBaseUrl: string, port: number): string {
  const parsed = new URL(opencodeBaseUrl);
  const host = formatHost(parsed.hostname);
  return `${parsed.protocol}//${host}:${port}`;
}

// ---------------------------------------------------------------------------
// Resolver
// ---------------------------------------------------------------------------

export function resolveConnectionEndpoints(
  profile: ConnectionProfile,
): ResolvedConnectionEndpoints {
  const opencodeBaseUrl = normalizeHttpUrl(profile.opencodeBaseUrl);

  if (profile.type === 'local') {
    return {
      opencodeBaseUrl,
      daemonBaseUrl: normalizeOptionalHttpUrl(profile.daemonBaseUrl ?? '') ??
        deriveBaseUrl(opencodeBaseUrl, PORTS.DAEMON),
      noVncUrl:
        normalizeOptionalHttpUrl(profile.noVncUrl ?? '') ??
        `${deriveBaseUrl(opencodeBaseUrl, PORTS.NOVNC)}/vnc.html?autoconnect=true&resize=scale`,
      webTerminalUrl:
        normalizeOptionalHttpUrl(profile.webTerminalUrl ?? '') ??
        deriveBaseUrl(opencodeBaseUrl, PORTS.WEB_TERMINAL),
    };
  }

  const daemonBaseUrl =
    normalizeOptionalHttpUrl(profile.daemonBaseUrl ?? '') ??
    deriveBaseUrl(opencodeBaseUrl, PORTS.DAEMON);
  const noVncUrl =
    normalizeOptionalHttpUrl(profile.noVncUrl ?? '') ??
    `${deriveBaseUrl(opencodeBaseUrl, PORTS.NOVNC)}/vnc.html?autoconnect=true&resize=scale`;
  const webTerminalUrl =
    normalizeOptionalHttpUrl(profile.webTerminalUrl ?? '') ??
    deriveBaseUrl(opencodeBaseUrl, PORTS.WEB_TERMINAL);

  return {
    opencodeBaseUrl,
    daemonBaseUrl,
    noVncUrl,
    webTerminalUrl,
  };
}
