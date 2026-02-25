/**
 * @license
 * Copyright 2026 cofy-x
 * SPDX-License-Identifier: Apache-2.0
 */

import { z } from 'zod';

import { readBool, readFlag, readPort } from './args.js';
import {
  ensureRouterDaemon,
  requestRouter,
  runRouterDaemon,
} from './router.js';
import type { HttpHeaders, ParsedArgs, StatusResult } from './types/index.js';
import { formatStatusText } from './status/formatter.js';
import { encodeBasicAuth } from './utils/network.js';
import { DEFAULT_BRIDGE_HEALTH_PORT } from './utils/process.js';
import {
  fetchJson,
  outputError,
  outputResult,
  waitForHealthy,
} from './utils/http.js';
import {
  createOpencodeSdkClient,
  fetchBridgeHealth,
  waitForOpencodeHealthy,
} from './services.js';

const genericJsonObjectSchema = z.record(z.string(), z.unknown());

// ---------------------------------------------------------------------------
// Daemon command
// ---------------------------------------------------------------------------

export async function runDaemonCommand(args: ParsedArgs): Promise<number> {
  const outputJson = readBool(args.flags, 'json', false);
  const subcommand = args.positionals[1] ?? 'run';

  try {
    if (subcommand === 'run' || subcommand === 'foreground') {
      return await runRouterDaemon(args);
    }
    if (subcommand === 'start') {
      const { baseUrl } = await ensureRouterDaemon(args, true);
      const status = await fetchJson<object>(
        `${baseUrl.replace(/\/$/, '')}/health`,
      );
      outputResult({ ok: true, baseUrl, ...status }, outputJson);
      return 0;
    }
    if (subcommand === 'status') {
      const { baseUrl } = await ensureRouterDaemon(args, false);
      const status = await fetchJson<object>(
        `${baseUrl.replace(/\/$/, '')}/health`,
      );
      outputResult({ ok: true, baseUrl, ...status }, outputJson);
      return 0;
    }
    if (subcommand === 'stop') {
      const { baseUrl } = await ensureRouterDaemon(args, false);
      await fetchJson<object>(`${baseUrl.replace(/\/$/, '')}/shutdown`, {
        method: 'POST',
      });
      outputResult({ ok: true }, outputJson);
      return 0;
    }
    throw new Error('daemon requires start|stop|status|run');
  } catch (error) {
    outputError(
      error instanceof Error ? error : new Error(String(error)),
      outputJson,
    );
    return 1;
  }
}

// ---------------------------------------------------------------------------
// Workspace command
// ---------------------------------------------------------------------------

export async function runWorkspaceCommand(args: ParsedArgs): Promise<number> {
  const outputJson = readBool(args.flags, 'json', false);
  const subcommand = args.positionals[1];
  const id = args.positionals[2];

  try {
    if (subcommand === 'add') {
      if (!id) throw new Error('workspace path is required');
      const name = readFlag(args.flags, 'name');
      const result = await requestRouter(args, 'POST', '/workspaces', {
        path: id,
        name: name ?? null,
      });
      outputResult({ ok: true, ...result }, outputJson);
      return 0;
    }
    if (subcommand === 'add-remote') {
      if (!id) throw new Error('baseUrl is required');
      const directory = readFlag(args.flags, 'directory');
      const name = readFlag(args.flags, 'name');
      const result = await requestRouter(args, 'POST', '/workspaces/remote', {
        baseUrl: id,
        directory: directory ?? null,
        name: name ?? null,
      });
      outputResult({ ok: true, ...result }, outputJson);
      return 0;
    }
    if (subcommand === 'list') {
      const result = await requestRouter(args, 'GET', '/workspaces');
      outputResult({ ok: true, ...result }, outputJson);
      return 0;
    }
    if (subcommand === 'switch') {
      if (!id) throw new Error('workspace id is required');
      const result = await requestRouter(
        args,
        'POST',
        `/workspaces/${encodeURIComponent(id)}/activate`,
      );
      outputResult({ ok: true, ...result }, outputJson);
      return 0;
    }
    if (subcommand === 'info') {
      if (!id) throw new Error('workspace id is required');
      const result = await requestRouter(
        args,
        'GET',
        `/workspaces/${encodeURIComponent(id)}`,
      );
      outputResult({ ok: true, ...result }, outputJson);
      return 0;
    }
    if (subcommand === 'path') {
      if (!id) throw new Error('workspace id is required');
      const result = await requestRouter(
        args,
        'GET',
        `/workspaces/${encodeURIComponent(id)}/path`,
      );
      outputResult({ ok: true, ...result }, outputJson);
      return 0;
    }
    throw new Error('workspace requires add|add-remote|list|switch|info|path');
  } catch (error) {
    outputError(
      error instanceof Error ? error : new Error(String(error)),
      outputJson,
    );
    return 1;
  }
}

// ---------------------------------------------------------------------------
// Instance command
// ---------------------------------------------------------------------------

export async function runInstanceCommand(args: ParsedArgs): Promise<number> {
  const outputJson = readBool(args.flags, 'json', false);
  const subcommand = args.positionals[1];
  const id = args.positionals[2];

  try {
    if (subcommand === 'dispose') {
      if (!id) throw new Error('workspace id is required');
      const result = await requestRouter(
        args,
        'POST',
        `/instances/${encodeURIComponent(id)}/dispose`,
      );
      outputResult({ ok: true, ...result }, outputJson);
      return 0;
    }
    throw new Error('instance requires dispose');
  } catch (error) {
    outputError(
      error instanceof Error ? error : new Error(String(error)),
      outputJson,
    );
    return 1;
  }
}

// ---------------------------------------------------------------------------
// Approvals command
// ---------------------------------------------------------------------------

export async function runApprovals(args: ParsedArgs): Promise<number> {
  const subcommand = args.positionals[1];
  if (!subcommand || (subcommand !== 'list' && subcommand !== 'reply')) {
    throw new Error("approvals requires 'list' or 'reply'");
  }

  const pilotUrl =
    readFlag(args.flags, 'pilot-url') ?? process.env['PILOT_URL'] ?? '';
  const hostToken =
    readFlag(args.flags, 'host-token') ?? process.env['PILOT_HOST_TOKEN'] ?? '';

  if (!pilotUrl || !hostToken) {
    throw new Error('pilot-url and host-token are required for approvals');
  }

  const headers: HttpHeaders = {
    'Content-Type': 'application/json',
    'X-Pilot-Host-Token': hostToken,
  };

  if (subcommand === 'list') {
    const response = await fetch(`${pilotUrl.replace(/\/$/, '')}/approvals`, {
      headers,
    });
    if (!response.ok) {
      throw new Error(`Failed to list approvals: ${response.status}`);
    }
    const raw = (await response.json()) as unknown;
    const parsed = genericJsonObjectSchema.safeParse(raw);
    if (!parsed.success) {
      throw new Error('Invalid approvals list response payload.');
    }
    process.stdout.write(`${JSON.stringify(parsed.data, null, 2)}\n`);
    return 0;
  }

  const approvalId = args.positionals[2];
  if (!approvalId) {
    throw new Error('approval id is required for approvals reply');
  }

  const allow = readBool(args.flags, 'allow', false);
  const deny = readBool(args.flags, 'deny', false);
  if (allow === deny) {
    throw new Error('use --allow or --deny');
  }

  const payload = { reply: allow ? 'allow' : 'deny' };
  const response = await fetch(
    `${pilotUrl.replace(/\/$/, '')}/approvals/${approvalId}`,
    {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
    },
  );
  if (!response.ok) {
    throw new Error(`Failed to reply to approval: ${response.status}`);
  }
  const raw = (await response.json()) as unknown;
  const parsed = genericJsonObjectSchema.safeParse(raw);
  if (!parsed.success) {
    throw new Error('Invalid approvals reply response payload.');
  }
  process.stdout.write(`${JSON.stringify(parsed.data, null, 2)}\n`);
  return 0;
}

// ---------------------------------------------------------------------------
// Status command
// ---------------------------------------------------------------------------

export async function runStatus(args: ParsedArgs): Promise<number> {
  const pilotUrl =
    readFlag(args.flags, 'pilot-url') ?? process.env['PILOT_URL'] ?? '';
  const bridgeUrlOverride =
    readFlag(args.flags, 'bridge-url') ?? process.env['PILOT_BRIDGE_URL'] ?? '';
  const bridgeHealthPort = readPort(
    args.flags,
    'bridge-health-port',
    DEFAULT_BRIDGE_HEALTH_PORT,
    'BRIDGE_HEALTH_PORT',
  );
  const bridgeUrl =
    bridgeUrlOverride.trim() ||
    `http://127.0.0.1:${bridgeHealthPort ?? DEFAULT_BRIDGE_HEALTH_PORT}`;
  const opencodeUrl =
    readFlag(args.flags, 'opencode-url') ??
    process.env['PILOT_OPENCODE_URL'] ??
    '';
  const username =
    readFlag(args.flags, 'opencode-username') ??
    process.env['PILOT_OPENCODE_USERNAME'] ??
    '';
  const password =
    readFlag(args.flags, 'opencode-password') ??
    process.env['PILOT_OPENCODE_PASSWORD'] ??
    '';
  const outputJson = readBool(args.flags, 'json', false);

  const status: StatusResult = {};

  if (pilotUrl) {
    try {
      await waitForHealthy(pilotUrl, 5000, 400);
      status.pilot = { ok: true, url: pilotUrl };
    } catch (error) {
      status.pilot = { ok: false, url: pilotUrl, error: String(error) };
    }
  }

  if (opencodeUrl) {
    try {
      const authHeaders =
        username && password
          ? { Authorization: `Basic ${encodeBasicAuth(username, password)}` }
          : undefined;
      const client = createOpencodeSdkClient({
        baseUrl: opencodeUrl,
        headers: authHeaders,
      });
      const health = await waitForOpencodeHealthy(client, 5000, 400);
      status.opencode = { ok: true, url: opencodeUrl, health };
    } catch (error) {
      status.opencode = { ok: false, url: opencodeUrl, error: String(error) };
    }
  }

  if (bridgeUrl) {
    try {
      const health = await fetchBridgeHealth(bridgeUrl);
      status.bridge = { ok: true, url: bridgeUrl, health };
    } catch (error) {
      status.bridge = { ok: false, url: bridgeUrl, error: String(error) };
    }
  }

  if (outputJson) {
    process.stdout.write(`${JSON.stringify(status, null, 2)}\n`);
  } else {
    process.stdout.write(formatStatusText(status));
  }

  const failed =
    (status.pilot && !status.pilot.ok) ||
    (status.opencode && !status.opencode.ok) ||
    (status.bridge && !status.bridge.ok);
  return failed ? 1 : 0;
}
