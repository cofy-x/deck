/**
 * @license
 * Copyright 2025 cofy-x
 * SPDX-License-Identifier: Apache-2.0
 */

import http from 'node:http';

import type { Logger } from 'pino';
import { z } from 'zod';

import type { HealthHandlers, HealthSnapshot } from './types/index.js';

// ---------------------------------------------------------------------------
// Request body helpers
// ---------------------------------------------------------------------------

const TelegramTokenPayloadSchema = z.object({
  token: z.string().min(1, 'Token is required'),
});

const SlackTokensPayloadSchema = z.object({
  botToken: z.string().min(1, 'Slack botToken is required'),
  appToken: z.string().min(1, 'Slack appToken is required'),
});

const GroupsPayloadSchema = z.object({
  enabled: z.union([z.boolean(), z.literal('true'), z.literal('false')]).optional(),
});

const MAX_BODY_SIZE = 1024 * 1024;

async function readBody(req: http.IncomingMessage): Promise<string | null> {
  let raw = '';
  for await (const chunk of req) {
    raw += chunk.toString();
    if (raw.length > MAX_BODY_SIZE) {
      return null;
    }
  }
  return raw;
}

function parseJsonBody(raw: string): { ok: true; value: unknown } | { ok: false } {
  try {
    return { ok: true, value: JSON.parse(raw || '{}') };
  } catch {
    return { ok: false };
  }
}

function jsonResponse(res: http.ServerResponse, status: number, data: object) {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(data));
}

// ---------------------------------------------------------------------------
// CORS helpers
// ---------------------------------------------------------------------------

function setCorsHeaders(req: http.IncomingMessage, res: http.ServerResponse) {
  const requestOrigin = req.headers.origin;
  if (requestOrigin) {
    res.setHeader('Access-Control-Allow-Origin', requestOrigin);
    res.setHeader('Vary', 'Origin');
  } else {
    res.setHeader('Access-Control-Allow-Origin', '*');
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');

  const requestHeaders = req.headers['access-control-request-headers'];
  if (Array.isArray(requestHeaders)) {
    res.setHeader('Access-Control-Allow-Headers', requestHeaders.join(', '));
  } else if (typeof requestHeaders === 'string' && requestHeaders.trim()) {
    res.setHeader('Access-Control-Allow-Headers', requestHeaders);
  } else {
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  }

  if (req.headers['access-control-request-private-network'] === 'true') {
    res.setHeader('Access-Control-Allow-Private-Network', 'true');
  }
}

// ---------------------------------------------------------------------------
// Route handlers
// ---------------------------------------------------------------------------

async function handleTelegramToken(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  handlers: HealthHandlers,
) {
  if (!handlers.setTelegramToken) {
    jsonResponse(res, 404, { ok: false, error: 'Not supported' });
    return;
  }

  const raw = await readBody(req);
  if (raw === null) {
    jsonResponse(res, 413, { ok: false, error: 'Payload too large' });
    return;
  }
  const parsedBody = parseJsonBody(raw);
  if (!parsedBody.ok) {
    jsonResponse(res, 400, { ok: false, error: 'Invalid JSON payload' });
    return;
  }

  try {
    const payload = TelegramTokenPayloadSchema.safeParse(parsedBody.value);
    if (!payload.success) {
      jsonResponse(res, 400, { ok: false, error: 'Token is required' });
      return;
    }
    const token = payload.data.token.trim();
    if (!token) {
      jsonResponse(res, 400, { ok: false, error: 'Token is required' });
      return;
    }

    const result = await handlers.setTelegramToken(token);
    jsonResponse(res, 200, { ok: true, telegram: result });
  } catch (error) {
    jsonResponse(res, 500, { ok: false, error: String(error) });
  }
}

async function handleSlackTokens(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  handlers: HealthHandlers,
) {
  if (!handlers.setSlackTokens) {
    jsonResponse(res, 404, { ok: false, error: 'Not supported' });
    return;
  }

  const raw = await readBody(req);
  if (raw === null) {
    jsonResponse(res, 413, { ok: false, error: 'Payload too large' });
    return;
  }
  const parsedBody = parseJsonBody(raw);
  if (!parsedBody.ok) {
    jsonResponse(res, 400, { ok: false, error: 'Invalid JSON payload' });
    return;
  }

  try {
    const payload = SlackTokensPayloadSchema.safeParse(parsedBody.value);
    if (!payload.success) {
      jsonResponse(res, 400, {
        ok: false,
        error: 'Slack botToken and appToken are required',
      });
      return;
    }
    const botToken = payload.data.botToken.trim();
    const appToken = payload.data.appToken.trim();
    if (!botToken || !appToken) {
      jsonResponse(res, 400, {
        ok: false,
        error: 'Slack botToken and appToken are required',
      });
      return;
    }

    const result = await handlers.setSlackTokens({ botToken, appToken });
    jsonResponse(res, 200, { ok: true, slack: result });
  } catch (error) {
    jsonResponse(res, 500, { ok: false, error: String(error) });
  }
}

async function handleGroupsPost(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  handlers: HealthHandlers,
) {
  if (!handlers.setGroupsEnabled) {
    jsonResponse(res, 404, { ok: false, error: 'Not supported' });
    return;
  }

  const raw = await readBody(req);
  if (raw === null) {
    jsonResponse(res, 413, { ok: false, error: 'Payload too large' });
    return;
  }
  const parsedBody = parseJsonBody(raw);
  if (!parsedBody.ok) {
    jsonResponse(res, 400, { ok: false, error: 'Invalid JSON payload' });
    return;
  }

  try {
    const payload = GroupsPayloadSchema.safeParse(parsedBody.value);
    if (!payload.success) {
      jsonResponse(res, 400, { ok: false, error: 'Invalid groups payload' });
      return;
    }
    const enabled =
      payload.data.enabled === true || payload.data.enabled === 'true';
    const result = await handlers.setGroupsEnabled(enabled);
    jsonResponse(res, 200, { ok: true, ...result });
  } catch (error) {
    jsonResponse(res, 500, { ok: false, error: String(error) });
  }
}

// ---------------------------------------------------------------------------
// Health server
// ---------------------------------------------------------------------------

export function startHealthServer(
  port: number,
  getStatus: () => HealthSnapshot,
  logger: Logger,
  handlers: HealthHandlers = {},
) {
  const server = http.createServer((req, res) => {
    void (async () => {
      setCorsHeaders(req, res);

      if (req.method === 'OPTIONS') {
        res.writeHead(204);
        res.end();
        return;
      }

      const pathname = req.url
        ? new URL(req.url, 'http://localhost').pathname
        : '';

      if (!pathname || pathname === '/' || pathname === '/health') {
        const snapshot = getStatus();
        jsonResponse(res, snapshot.ok ? 200 : 503, snapshot);
        return;
      }

      if (pathname === '/config/telegram-token' && req.method === 'POST') {
        await handleTelegramToken(req, res, handlers);
        return;
      }

      if (pathname === '/config/slack-tokens' && req.method === 'POST') {
        await handleSlackTokens(req, res, handlers);
        return;
      }

      if (pathname === '/config/groups' && req.method === 'GET') {
        if (!handlers.getGroupsEnabled) {
          jsonResponse(res, 404, { ok: false, error: 'Not supported' });
          return;
        }
        const groupsEnabled = handlers.getGroupsEnabled();
        jsonResponse(res, 200, { ok: true, groupsEnabled });
        return;
      }

      if (pathname === '/config/groups' && req.method === 'POST') {
        await handleGroupsPost(req, res, handlers);
        return;
      }

      jsonResponse(res, 404, { ok: false, error: 'Not found' });
    })().catch((error) => {
      logger.error({ error }, 'health server request failed');
      jsonResponse(res, 500, { ok: false, error: 'Internal error' });
    });
  });

  server.listen(port, '0.0.0.0', () => {
    logger.info({ port }, 'health server listening');
  });

  return () => {
    server.close();
  };
}
