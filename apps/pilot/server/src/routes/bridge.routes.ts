/**
 * @license
 * Copyright 2026 cofy-x
 * SPDX-License-Identifier: Apache-2.0
 */

import type { ServerConfig } from '../types/index.js';
import type { Route } from '../http/router.js';
import { addRoute } from '../http/router.js';
import { jsonResponse, readAndValidateJsonBody } from '../http/response.js';
import { ApiError } from '../errors.js';
import {
  logBridgeDebug,
  resolveBridgeConfigPath,
  updateBridgeTelegramToken,
  updateBridgeSlackTokens,
} from '../services/bridge.service.js';
import {
  bridgeSlackBodySchema,
  bridgeTelegramBodySchema,
} from '../schemas/route.schema.js';
import { runWorkspaceWriteAction } from './workspace-write.js';

export function registerBridgeRoutes(
  routes: Route[],
  config: ServerConfig,
): void {
  addRoute(
    routes,
    'POST',
    '/workspace/:id/bridge/telegram-token',
    'client',
    async (ctx) => {
      const body = await readAndValidateJsonBody(
        ctx.request,
        bridgeTelegramBodySchema,
      );
      const token = body.token.trim();
      const healthPort = body.healthPort ?? null;
      if (!token) {
        throw new ApiError(400, 'token_required', 'Telegram token is required');
      }

      const result = await runWorkspaceWriteAction({
        config,
        ctx,
        approval: () => ({
          action: 'bridge.telegram.set-token',
          summary: 'Set Telegram bot token',
          paths: [resolveBridgeConfigPath()],
        }),
        mutate: async (workspace) => {
          logBridgeDebug('telegram-token:request', {
            workspaceId: workspace.id,
            actor: ctx.actor?.type ?? 'unknown',
            hasToken: true,
            healthPort: healthPort ?? null,
          });
          const response = await updateBridgeTelegramToken(token, healthPort);
          logBridgeDebug('telegram-token:updated', { workspaceId: workspace.id });
          return response;
        },
        audit: () => ({
          action: 'bridge.telegram.set-token',
          target: 'bridge.telegram',
          summary: 'Updated Telegram bot token',
        }),
      });

      return jsonResponse(result);
    },
  );

  addRoute(
    routes,
    'POST',
    '/workspace/:id/bridge/slack-tokens',
    'client',
    async (ctx) => {
      const body = await readAndValidateJsonBody(
        ctx.request,
        bridgeSlackBodySchema,
      );
      const botToken = body.botToken.trim();
      const appToken = body.appToken.trim();
      const healthPort = body.healthPort ?? null;
      if (!botToken || !appToken) {
        throw new ApiError(
          400,
          'token_required',
          'Slack botToken and appToken are required',
        );
      }

      const result = await runWorkspaceWriteAction({
        config,
        ctx,
        approval: () => ({
          action: 'bridge.slack.set-tokens',
          summary: 'Set Slack bot tokens',
          paths: [resolveBridgeConfigPath()],
        }),
        mutate: async (workspace) => {
          logBridgeDebug('slack-tokens:request', {
            workspaceId: workspace.id,
            actor: ctx.actor?.type ?? 'unknown',
            hasBotToken: true,
            hasAppToken: true,
            healthPort: healthPort ?? null,
          });
          const response = await updateBridgeSlackTokens(
            botToken,
            appToken,
            healthPort,
          );
          logBridgeDebug('slack-tokens:updated', { workspaceId: workspace.id });
          return response;
        },
        audit: () => ({
          action: 'bridge.slack.set-tokens',
          target: 'bridge.slack',
          summary: 'Updated Slack bot tokens',
        }),
      });

      return jsonResponse(result);
    },
  );
}
