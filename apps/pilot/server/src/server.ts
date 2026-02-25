/**
 * @license
 * Copyright 2026 cofy-x
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  createServer,
  type IncomingMessage,
  type Server,
  type ServerResponse,
} from 'node:http';
import type { AuthMode, ServerConfig } from './types/index.js';
import { ApprovalService } from './services/approval.service.js';
import { ReloadEventStore } from './services/event-store.js';
import { ApiError, formatError } from './errors.js';
import {
  collectBody,
  incomingToRequest,
  writeWebResponse,
} from './http/adapter.js';
import { requireClient, requireHost } from './http/auth.js';
import { withCors } from './http/cors.js';
import { matchRoute, parseWorkspaceMount } from './http/router.js';
import { jsonResponse } from './http/response.js';
import { createServerLogger, logRequest } from './http/logger.js';
import { createRoutes } from './routes/index.js';
import { proxyOpencodeRequest } from './proxy/opencode-proxy.js';
import {
  resolveActiveWorkspace,
  resolveWorkspace,
} from './services/workspace.service.js';

export { createServerLogger } from './http/logger.js';

export function startServer(config: ServerConfig): Server {
  const approvals = new ApprovalService(config.approval);
  const reloadEvents = new ReloadEventStore();
  const routes = createRoutes(config);
  const logger = createServerLogger(config);

  const handleRequest = async (request: Request): Promise<Response> => {
    const url = new URL(request.url);
    const startedAt = Date.now();
    let authMode: AuthMode = 'none';
    let proxyBaseUrl: string | undefined;
    let errorMessage: string | undefined;

    const finalize = (response: Response) => {
      const wrapped = withCors(response, request, config);
      if (config.logRequests) {
        logRequest({
          logger,
          request,
          response: wrapped,
          durationMs: Date.now() - startedAt,
          authMode,
          proxyBaseUrl,
          error: errorMessage,
        });
      }
      return wrapped;
    };

    if (request.method === 'OPTIONS') {
      return finalize(new Response(null, { status: 204 }));
    }

    const mount = parseWorkspaceMount(url.pathname);
    if (
      mount &&
      (mount.restPath === '/opencode' ||
        mount.restPath.startsWith('/opencode/'))
    ) {
      authMode = 'client';
      try {
        requireClient(request, config);
        const workspace = await resolveWorkspace(config, mount.workspaceId);
        proxyBaseUrl = workspace.baseUrl?.trim() || undefined;
        const response = await proxyOpencodeRequest({
          request,
          url,
          workspace,
          proxyPath: mount.restPath,
        });
        return finalize(response);
      } catch (error) {
        const apiError =
          error instanceof ApiError
            ? error
            : new ApiError(500, 'internal_error', 'Unexpected server error');
        errorMessage = apiError.message;
        return finalize(jsonResponse(formatError(apiError), apiError.status));
      }
    }

    if (url.pathname === '/opencode' || url.pathname.startsWith('/opencode/')) {
      authMode = 'client';
      try {
        requireClient(request, config);
        const workspace = await resolveActiveWorkspace(config);
        proxyBaseUrl = workspace.baseUrl?.trim() || undefined;
        const response = await proxyOpencodeRequest({
          request,
          url,
          workspace,
        });
        return finalize(response);
      } catch (error) {
        const apiError =
          error instanceof ApiError
            ? error
            : new ApiError(500, 'internal_error', 'Unexpected server error');
        errorMessage = apiError.message;
        return finalize(jsonResponse(formatError(apiError), apiError.status));
      }
    }

    const route = matchRoute(routes, request.method, url.pathname);
    if (!route) {
      errorMessage = 'not_found';
      return finalize(
        jsonResponse({ code: 'not_found', message: 'Not found' }, 404),
      );
    }

    authMode = route.auth;
    try {
      const actor =
        route.auth === 'host'
          ? requireHost(request, config)
          : route.auth === 'client'
            ? requireClient(request, config)
            : undefined;
      const response = await route.handler({
        request,
        url,
        params: route.params,
        config,
        approvals,
        reloadEvents,
        actor,
      });
      return finalize(response);
    } catch (error) {
      const apiError =
        error instanceof ApiError
          ? error
          : new ApiError(500, 'internal_error', 'Unexpected server error');
      errorMessage = apiError.message;
      return finalize(jsonResponse(formatError(apiError), apiError.status));
    }
  };

  const server = createServer(
    async (req: IncomingMessage, res: ServerResponse) => {
      try {
        const host = req.headers.host ?? 'localhost';
        const requestUrl = new URL(`http://${host}${req.url ?? '/'}`);
        const mount = parseWorkspaceMount(requestUrl.pathname);
        const workspaceProxyRequest =
          mount &&
          (mount.restPath === '/opencode' ||
            mount.restPath.startsWith('/opencode/'));
        const globalProxyRequest =
          requestUrl.pathname === '/opencode' ||
          requestUrl.pathname.startsWith('/opencode/');
        const streamProxy = Boolean(workspaceProxyRequest || globalProxyRequest);
        const request = streamProxy
          ? await incomingToRequest(req, { streamBody: true })
          : await incomingToRequest(req, {
              body: await collectBody(req, config.maxBodyBytes),
            });
        const response = await handleRequest(request);
        await writeWebResponse(response, res);
      } catch (error) {
        const apiError =
          error instanceof ApiError
            ? error
            : new ApiError(500, 'internal_error', 'Unexpected server error');
        if (!res.headersSent) {
          res.writeHead(apiError.status, { 'Content-Type': 'application/json' });
        }
        res.end(JSON.stringify(formatError(apiError)));
      }
    },
  );

  server.listen(config.port, config.host);

  return server;
}
