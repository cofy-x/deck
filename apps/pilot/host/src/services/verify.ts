/**
 * @license
 * Copyright 2026 cofy-x
 * SPDX-License-Identifier: Apache-2.0
 */

import { assertVersionMatch, readCliVersion } from '../binary/version.js';
import type {
  HttpHeaders,
  PilotHealthResponse,
  PilotWorkspacesResponse,
  ResolvedBinary,
} from '../types/index.js';
import { fetchJson } from '../utils/http.js';
import { normalizeWorkspacePath } from '../utils/process.js';

export async function verifyBridgeVersion(
  binary: ResolvedBinary,
): Promise<string | undefined> {
  if (binary.source !== 'external') {
    return binary.expectedVersion;
  }
  const actual = await readCliVersion(binary.bin);
  assertVersionMatch('bridge', binary.expectedVersion, actual, binary.bin);
  return actual;
}

export async function verifyOpencodeVersion(
  binary: ResolvedBinary,
): Promise<string | undefined> {
  const actual = await readCliVersion(binary.bin);
  assertVersionMatch('opencode', binary.expectedVersion, actual, binary.bin);
  return actual;
}

interface VerifyPilotServerInput {
  baseUrl: string;
  token: string;
  hostToken: string;
  expectedVersion?: string;
  expectedWorkspace: string;
  expectedOpencodeBaseUrl?: string;
  expectedOpencodeDirectory?: string;
  expectedOpencodeUsername?: string;
  expectedOpencodePassword?: string;
}

export async function verifyPilotServer(
  input: VerifyPilotServerInput,
): Promise<string | undefined> {
  const health = await fetchJson<PilotHealthResponse>(
    `${input.baseUrl}/health`,
  );
  const actualVersion = health.version;
  assertVersionMatch(
    'pilot-server',
    input.expectedVersion,
    actualVersion,
    `${input.baseUrl}/health`,
  );

  const headers: HttpHeaders = { Authorization: `Bearer ${input.token}` };
  const workspaces = await fetchJson<PilotWorkspacesResponse>(
    `${input.baseUrl}/workspaces`,
    { headers },
  );
  const items = workspaces.items ?? [];
  if (!items.length) {
    throw new Error('Pilot server returned no workspaces');
  }

  const activeId = workspaces.activeId;
  if (!activeId) {
    throw new Error('Pilot server returned no active workspace');
  }
  const active = items.find((item) => item.id === activeId);
  if (!active) {
    throw new Error(
      `Pilot server active workspace mismatch. activeId=${activeId} is missing from workspace list.`,
    );
  }

  const expectedPath = normalizeWorkspacePath(input.expectedWorkspace);
  if (!active.path) {
    throw new Error('Pilot server returned invalid workspace payload');
  }
  const activePath = normalizeWorkspacePath(active.path);
  if (activePath !== expectedPath) {
    throw new Error(
      `Pilot server workspace mismatch. Expected ${expectedPath}, got ${activePath}.`,
    );
  }

  const opencode = active.opencode;
  if (
    input.expectedOpencodeBaseUrl &&
    opencode?.baseUrl !== input.expectedOpencodeBaseUrl
  ) {
    throw new Error(
      `Pilot server OpenCode base URL mismatch: expected ${input.expectedOpencodeBaseUrl}, got ${opencode?.baseUrl ?? '<missing>'}.`,
    );
  }
  if (
    input.expectedOpencodeDirectory &&
    opencode?.directory !== input.expectedOpencodeDirectory
  ) {
    throw new Error(
      `Pilot server OpenCode directory mismatch: expected ${input.expectedOpencodeDirectory}, got ${opencode?.directory ?? '<missing>'}.`,
    );
  }
  if (
    input.expectedOpencodeUsername &&
    opencode?.username !== input.expectedOpencodeUsername
  ) {
    throw new Error('Pilot server OpenCode username mismatch.');
  }
  if (
    input.expectedOpencodePassword &&
    opencode?.password !== input.expectedOpencodePassword
  ) {
    throw new Error('Pilot server OpenCode password mismatch.');
  }

  const hostHeaders: HttpHeaders = { 'X-Pilot-Host-Token': input.hostToken };
  await fetchJson<object>(`${input.baseUrl}/approvals`, {
    headers: hostHeaders,
  });

  return actualVersion;
}
