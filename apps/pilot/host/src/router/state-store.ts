/**
 * @license
 * Copyright 2026 cofy-x
 * SPDX-License-Identifier: Apache-2.0
 */

import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';

import { z } from 'zod';

import type { RouterState } from '../types/index.js';

export type StateStoreWarningHandler = (message: string) => void;

interface StateStoreOptions {
  onWarning?: StateStoreWarningHandler;
}

const binarySourceSchema = z.enum(['bundled', 'external', 'downloaded']);
const binarySourcePreferenceSchema = z.enum([
  'auto',
  'bundled',
  'downloaded',
  'external',
]);
const sidecarTargetSchema = z
  .enum([
    'darwin-arm64',
    'darwin-x64',
    'linux-x64',
    'linux-arm64',
    'windows-x64',
    'windows-arm64',
  ])
  .nullable();

const routerWorkspaceSchema = z.object({
  id: z.string(),
  name: z.string(),
  path: z.string(),
  workspaceType: z.enum(['local', 'remote']),
  baseUrl: z.string().optional(),
  directory: z.string().optional(),
  createdAt: z.number().int(),
  lastUsedAt: z.number().int().optional(),
});

const routerBinaryInfoSchema = z.object({
  path: z.string(),
  source: binarySourceSchema,
  expectedVersion: z.string().optional(),
  actualVersion: z.string().optional(),
});

const routerStateSchema = z.object({
  version: z.number().int().optional(),
  daemon: z
    .object({
      pid: z.number().int(),
      port: z.number().int(),
      baseUrl: z.string(),
      startedAt: z.number().int(),
    })
    .optional(),
  opencode: z
    .object({
      pid: z.number().int(),
      port: z.number().int(),
      baseUrl: z.string(),
      startedAt: z.number().int(),
    })
    .optional(),
  cliVersion: z.string().optional(),
  sidecar: z
    .object({
      dir: z.string(),
      baseUrl: z.string(),
      manifestUrl: z.string(),
      target: sidecarTargetSchema,
      source: binarySourcePreferenceSchema,
      opencodeSource: binarySourcePreferenceSchema,
      allowExternal: z.boolean(),
    })
    .optional(),
  binaries: z
    .object({
      opencode: routerBinaryInfoSchema.optional(),
    })
    .optional(),
  activeId: z.string().optional(),
  workspaces: z.array(routerWorkspaceSchema).optional(),
});

const stateWriteQueue = new Map<string, Promise<void>>();

function defaultWarningHandler(message: string): void {
  process.stderr.write(`[pilot-host] ${message}\n`);
}

function warn(
  options: StateStoreOptions | undefined,
  message: string,
): void {
  const writer = options?.onWarning ?? defaultWarningHandler;
  writer(message);
}

function emptyRouterState(): RouterState {
  return {
    version: 1,
    daemon: undefined,
    opencode: undefined,
    cliVersion: undefined,
    sidecar: undefined,
    binaries: undefined,
    activeId: '',
    workspaces: [],
  };
}

export function routerStatePath(dataDir: string): string {
  return join(dataDir, 'pilot-state.json');
}

function normalizeRouterState(input: z.infer<typeof routerStateSchema>): RouterState {
  return {
    version: input.version ?? 1,
    daemon: input.daemon,
    opencode: input.opencode,
    cliVersion: input.cliVersion,
    sidecar: input.sidecar,
    binaries: input.binaries,
    activeId: input.activeId ?? '',
    workspaces: input.workspaces ?? [],
  };
}

export async function loadRouterState(
  path: string,
  options?: StateStoreOptions,
): Promise<RouterState> {
  try {
    const raw = await readFile(path, 'utf8');
    const json = JSON.parse(raw) as unknown;
    const parsed = routerStateSchema.safeParse(json);
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      warn(
        options,
        `Invalid router state at ${path}: ${issue?.message ?? 'schema validation failed'}. Falling back to defaults.`,
      );
      return emptyRouterState();
    }
    return normalizeRouterState(parsed.data);
  } catch (error) {
    if (error instanceof SyntaxError) {
      warn(
        options,
        `Failed to parse router state JSON at ${path}: ${error.message}. Falling back to defaults.`,
      );
    }
    return emptyRouterState();
  }
}

export async function saveRouterState(
  path: string,
  state: RouterState,
): Promise<void> {
  const nextTask = (stateWriteQueue.get(path) ?? Promise.resolve()).then(
    async () => {
      const parsed = routerStateSchema.safeParse(state);
      if (!parsed.success) {
        const issue = parsed.error.issues[0];
        throw new Error(
          `Invalid router state payload: ${issue?.message ?? 'schema validation failed'}.`,
        );
      }
      const payload = JSON.stringify(normalizeRouterState(parsed.data), null, 2);
      const tempPath = `${path}.tmp-${process.pid}-${Date.now()}`;
      await mkdir(dirname(path), { recursive: true });
      await writeFile(tempPath, `${payload}\n`, 'utf8');
      await rename(tempPath, path);
      await rm(tempPath, { force: true });
    },
  );

  stateWriteQueue.set(
    path,
    nextTask.catch(() => undefined),
  );
  await nextTask;
}
