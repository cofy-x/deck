/**
 * @license
 * Copyright 2026 cofy-x
 * SPDX-License-Identifier: Apache-2.0
 */

import type { ServiceHealthStatus, StatusResult } from '../types/index.js';
import { BRIDGE_CHANNEL_NAMES } from '../utils/bridge-health.js';

function formatServiceLine(
  label: string,
  service: ServiceHealthStatus | undefined,
  lines: string[],
): void {
  if (!service) return;
  lines.push(`${label}: ${service.ok ? 'ok' : 'error'} (${service.url})`);
  if (service.error) {
    lines.push(`  ${service.error}`);
  }
}

export function formatStatusText(status: StatusResult): string {
  const lines: string[] = [];
  formatServiceLine('Pilot server', status.pilot, lines);
  formatServiceLine('OpenCode server', status.opencode, lines);
  formatServiceLine('Bridge', status.bridge, lines);

  if (status.bridge?.health) {
    const enabledChannels = BRIDGE_CHANNEL_NAMES.filter(
      (channel) => status.bridge?.health?.channels[channel] === true,
    );
    const disabledChannels = BRIDGE_CHANNEL_NAMES.filter(
      (channel) => status.bridge?.health?.channels[channel] !== true,
    );
    const formatChannels = (channels: string[]): string =>
      channels.length ? channels.join(', ') : 'none';
    lines.push('  Bridge channels:');
    lines.push(
      `    enabled (${enabledChannels.length}): ${formatChannels(enabledChannels)}`,
    );
    lines.push(
      `    disabled (${disabledChannels.length}): ${formatChannels(disabledChannels)}`,
    );
  }

  const services = [status.pilot, status.opencode, status.bridge].filter(
    (entry): entry is ServiceHealthStatus => entry !== undefined,
  );
  if (services.length > 0) {
    const healthyCount = services.filter((entry) => entry.ok).length;
    lines.push(`Summary: ${healthyCount}/${services.length} services healthy`);
  } else {
    lines.push('Summary: no services checked');
  }

  return `${lines.join('\n')}\n`;
}
