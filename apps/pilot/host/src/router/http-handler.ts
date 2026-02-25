/**
 * @license
 * Copyright 2026 cofy-x
 * SPDX-License-Identifier: Apache-2.0
 */

import type { IncomingMessage, ServerResponse } from 'node:http';

import { z } from 'zod';

import { createOpencodeSdkClient } from '../services.js';
import type {
  HttpHeaders,
  InstanceDisposeResult,
  Logger,
  OpencodePathResponse,
  RouterState,
  RouterWorkspace,
} from '../types/index.js';
import {
  findWorkspace,
  nowMs,
  workspaceIdForLocal,
  workspaceIdForRemote,
} from '../utils/process.js';
import { ensureWorkspace } from '../utils/fs.js';
import { saveRouterState } from './state-store.js';

const addWorkspaceSchema = z.object({
  path: z.string().trim().min(1, 'path is required'),
  name: z.string().trim().optional().nullable(),
});

const addRemoteWorkspaceSchema = z.object({
  baseUrl: z
    .string()
    .trim()
    .refine(
      (value) => value.startsWith('http://') || value.startsWith('https://'),
      'baseUrl must start with http:// or https://',
    ),
  directory: z.string().trim().optional().nullable(),
  name: z.string().trim().optional().nullable(),
});

class RouterHttpError extends Error {
  constructor(
    readonly statusCode: number,
    message: string,
  ) {
    super(message);
  }
}

function zodIssueMessage(error: z.ZodError): string {
  const issue = error.issues[0];
  if (!issue) return 'invalid request body';
  return issue.message;
}

async function readRequestBody<TBody extends object>(
  req: IncomingMessage,
): Promise<TBody | null> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk)));
  }
  if (!chunks.length) return null;
  const raw = Buffer.concat(chunks).toString('utf8');
  if (!raw.trim()) return null;
  try {
    return JSON.parse(raw) as TBody;
  } catch {
    throw new RouterHttpError(400, 'invalid JSON body');
  }
}

interface CreateRouterHttpHandlerOptions {
  host: string;
  port: number;
  logger: Logger;
  state: RouterState;
  statePath: string;
  authHeaders?: HttpHeaders;
  ensureOpencode: () => Promise<{ baseUrl: string }>;
  shutdown: () => Promise<void>;
}

function applyCorsHeaders(res: ServerResponse): void {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

function defaultWorkspaceName(path: string): string {
  return path.split(/[\\/]/).filter(Boolean).pop() ?? 'Workspace';
}

function resolveWorkspaceEndpoint(
  workspace: RouterWorkspace,
  localBaseUrl: string,
): { baseUrl: string; directory: string } {
  if (workspace.workspaceType === 'remote') {
    return {
      baseUrl: workspace.baseUrl ?? '',
      directory: workspace.directory ?? '',
    };
  }
  return {
    baseUrl: localBaseUrl,
    directory: workspace.path,
  };
}

async function handleWorkspacePath(
  workspace: RouterWorkspace,
  localBaseUrl: string,
  authHeaders: HttpHeaders | undefined,
): Promise<OpencodePathResponse> {
  const endpoint = resolveWorkspaceEndpoint(workspace, localBaseUrl);
  if (!endpoint.baseUrl) {
    throw new RouterHttpError(400, 'workspace baseUrl missing');
  }
  const client = createOpencodeSdkClient({
    baseUrl: endpoint.baseUrl,
    directory: endpoint.directory || undefined,
    headers: authHeaders,
  });
  return (await client.path.get()) as OpencodePathResponse;
}

interface DisposeFailureBody {
  message?: string;
}

async function handleInstanceDispose(
  workspace: RouterWorkspace,
  localBaseUrl: string,
  authHeaders: HttpHeaders | undefined,
): Promise<InstanceDisposeResult> {
  const endpoint = resolveWorkspaceEndpoint(workspace, localBaseUrl);
  if (!endpoint.baseUrl) {
    throw new RouterHttpError(400, 'workspace baseUrl missing');
  }
  const response = await fetch(
    `${endpoint.baseUrl.replace(/\/$/, '')}/instance/dispose?directory=${encodeURIComponent(endpoint.directory)}`,
    { method: 'POST', headers: authHeaders },
  );
  if (!response.ok) {
    let detail = '';
    try {
      const body = (await response.json()) as DisposeFailureBody;
      if (typeof body.message === 'string' && body.message.trim()) {
        detail = ` ${body.message.trim()}`;
      }
    } catch {
      // ignore parse errors
    }
    throw new RouterHttpError(
      502,
      `upstream dispose failed (HTTP ${response.status})${detail}`,
    );
  }
  return (await response.json()) as InstanceDisposeResult;
}

export function createRouterHttpHandler(
  options: CreateRouterHttpHandlerOptions,
): (req: IncomingMessage, res: ServerResponse) => Promise<void> {
  return async (req, res): Promise<void> => {
    const startedAt = Date.now();
    const method = req.method ?? 'GET';
    const url = new URL(
      req.url ?? '/',
      `http://${options.host}:${options.port}`,
    );
    res.on('finish', () => {
      options.logger.info(
        'Router request',
        {
          method,
          path: url.pathname,
          status: res.statusCode,
          durationMs: Date.now() - startedAt,
          activeId: options.state.activeId,
        },
        'pilot-router',
      );
    });
    applyCorsHeaders(res);

    if (method === 'OPTIONS') {
      res.statusCode = 204;
      res.end();
      return;
    }

    const parts = url.pathname.split('/').filter(Boolean);
    const sendJson = <TPayload extends object>(
      statusCode: number,
      payload: TPayload,
    ): void => {
      res.statusCode = statusCode;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify(payload));
    };

    try {
      if (method === 'GET' && url.pathname === '/health') {
        sendJson(200, {
          ok: true,
          daemon: options.state.daemon ?? null,
          opencode: options.state.opencode ?? null,
          activeId: options.state.activeId,
          workspaceCount: options.state.workspaces.length,
          cliVersion: options.state.cliVersion ?? null,
          sidecar: options.state.sidecar ?? null,
          binaries: options.state.binaries ?? null,
        });
        return;
      }

      if (method === 'GET' && url.pathname === '/workspaces') {
        sendJson(200, {
          activeId: options.state.activeId,
          workspaces: options.state.workspaces,
        });
        return;
      }

      if (method === 'POST' && url.pathname === '/workspaces') {
        const body = await readRequestBody(req);
        const parsed = addWorkspaceSchema.safeParse(body ?? {});
        if (!parsed.success) {
          throw new RouterHttpError(400, zodIssueMessage(parsed.error));
        }
        const resolvedPath = await ensureWorkspace(parsed.data.path);
        const id = workspaceIdForLocal(resolvedPath);
        const existing = options.state.workspaces.find(
          (entry) => entry.id === id,
        );
        const entry: RouterWorkspace = {
          id,
          name:
            parsed.data.name && parsed.data.name.trim()
              ? parsed.data.name.trim()
              : defaultWorkspaceName(resolvedPath),
          path: resolvedPath,
          workspaceType: 'local',
          createdAt: existing?.createdAt ?? nowMs(),
          lastUsedAt: nowMs(),
        };
        options.state.workspaces = options.state.workspaces.filter(
          (item) => item.id !== id,
        );
        options.state.workspaces.push(entry);
        if (!options.state.activeId) options.state.activeId = id;
        await saveRouterState(options.statePath, options.state);
        sendJson(200, { activeId: options.state.activeId, workspace: entry });
        return;
      }

      if (method === 'POST' && url.pathname === '/workspaces/remote') {
        const body = await readRequestBody(req);
        const parsed = addRemoteWorkspaceSchema.safeParse(body ?? {});
        if (!parsed.success) {
          throw new RouterHttpError(400, zodIssueMessage(parsed.error));
        }
        const directory = parsed.data.directory?.trim() ?? '';
        const id = workspaceIdForRemote(
          parsed.data.baseUrl,
          directory || undefined,
        );
        const existing = options.state.workspaces.find(
          (entry) => entry.id === id,
        );
        const entry: RouterWorkspace = {
          id,
          name:
            parsed.data.name && parsed.data.name.trim()
              ? parsed.data.name.trim()
              : parsed.data.baseUrl,
          path: directory,
          workspaceType: 'remote',
          baseUrl: parsed.data.baseUrl,
          directory: directory || undefined,
          createdAt: existing?.createdAt ?? nowMs(),
          lastUsedAt: nowMs(),
        };
        options.state.workspaces = options.state.workspaces.filter(
          (item) => item.id !== id,
        );
        options.state.workspaces.push(entry);
        if (!options.state.activeId) options.state.activeId = id;
        await saveRouterState(options.statePath, options.state);
        sendJson(200, { activeId: options.state.activeId, workspace: entry });
        return;
      }

      if (parts[0] === 'workspaces' && parts.length === 2 && method === 'GET') {
        const workspace = findWorkspace(
          options.state,
          decodeURIComponent(parts[1] ?? ''),
        );
        if (!workspace) {
          sendJson(404, { error: 'workspace not found' });
          return;
        }
        sendJson(200, { workspace });
        return;
      }

      if (
        parts[0] === 'workspaces' &&
        parts.length === 3 &&
        parts[2] === 'activate' &&
        method === 'POST'
      ) {
        const workspace = findWorkspace(
          options.state,
          decodeURIComponent(parts[1] ?? ''),
        );
        if (!workspace) {
          sendJson(404, { error: 'workspace not found' });
          return;
        }
        options.state.activeId = workspace.id;
        workspace.lastUsedAt = nowMs();
        await saveRouterState(options.statePath, options.state);
        sendJson(200, { activeId: options.state.activeId, workspace });
        return;
      }

      if (
        parts[0] === 'workspaces' &&
        parts.length === 3 &&
        parts[2] === 'path' &&
        method === 'GET'
      ) {
        const workspace = findWorkspace(
          options.state,
          decodeURIComponent(parts[1] ?? ''),
        );
        if (!workspace) {
          sendJson(404, { error: 'workspace not found' });
          return;
        }
        const local = await options.ensureOpencode();
        const pathResult = await handleWorkspacePath(
          workspace,
          local.baseUrl,
          options.authHeaders,
        );
        workspace.lastUsedAt = nowMs();
        await saveRouterState(options.statePath, options.state);
        sendJson(200, { workspace, path: pathResult.data ?? {} });
        return;
      }

      if (
        parts[0] === 'instances' &&
        parts.length === 3 &&
        parts[2] === 'dispose' &&
        method === 'POST'
      ) {
        const workspace = findWorkspace(
          options.state,
          decodeURIComponent(parts[1] ?? ''),
        );
        if (!workspace) {
          sendJson(404, { error: 'workspace not found' });
          return;
        }
        const local = await options.ensureOpencode();
        const disposed = await handleInstanceDispose(
          workspace,
          local.baseUrl,
          options.authHeaders,
        );
        workspace.lastUsedAt = nowMs();
        await saveRouterState(options.statePath, options.state);
        sendJson(200, { disposed });
        return;
      }

      if (method === 'POST' && url.pathname === '/shutdown') {
        sendJson(200, { ok: true });
        await options.shutdown();
        return;
      }

      sendJson(404, { error: 'not found' });
    } catch (error) {
      if (error instanceof RouterHttpError) {
        sendJson(error.statusCode, { error: error.message });
        return;
      }
      sendJson(500, {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  };
}
