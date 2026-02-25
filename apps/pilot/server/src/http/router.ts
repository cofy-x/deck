/**
 * @license
 * Copyright 2026 cofy-x
 * SPDX-License-Identifier: Apache-2.0
 */

import type { Actor, AuthMode, ServerConfig } from '../types/index.js';
import { ApiError } from '../errors.js';
import type { ApprovalService } from '../services/approval.service.js';
import type { ReloadEventStore } from '../services/event-store.js';

export interface RequestContext {
  request: Request;
  url: URL;
  params: Record<string, string>;
  config: ServerConfig;
  approvals: ApprovalService;
  reloadEvents: ReloadEventStore;
  actor?: Actor;
}

export type RouteHandler = (ctx: RequestContext) => Promise<Response>;

export interface Route {
  method: string;
  regex: RegExp;
  keys: string[];
  auth: AuthMode;
  handler: RouteHandler;
}

export interface MatchedRoute extends Route {
  params: Record<string, string>;
}

function decodeRouteParam(rawValue: string, key: string): string {
  try {
    return decodeURIComponent(rawValue);
  } catch {
    throw new ApiError(
      400,
      'invalid_route_param',
      `Invalid route parameter: ${key}`,
    );
  }
}

export function addRoute(
  routes: Route[],
  method: string,
  path: string,
  auth: AuthMode,
  handler: RouteHandler,
): void {
  const keys: string[] = [];
  const regex = pathToRegex(path, keys);
  routes.push({ method, regex, keys, auth, handler });
}

export function matchRoute(
  routes: Route[],
  method: string,
  path: string,
): MatchedRoute | null {
  for (const route of routes) {
    if (route.method !== method) continue;
    const match = path.match(route.regex);
    if (!match) continue;
    const params: Record<string, string> = {};
    route.keys.forEach((key, index) => {
      const rawValue = match[index + 1] ?? '';
      params[key] = decodeRouteParam(rawValue, key);
    });
    return { ...route, params };
  }
  return null;
}

export function parseWorkspaceMount(
  pathname: string,
): { workspaceId: string; restPath: string } | null {
  if (!pathname.startsWith('/w/')) return null;
  const remainder = pathname.slice(3);
  if (!remainder) return null;
  const slash = remainder.indexOf('/');
  if (slash === -1) {
    const workspaceId = decodeRouteParam(remainder, 'id');
    if (!workspaceId.trim()) return null;
    return { workspaceId, restPath: '/' };
  }
  const workspaceId = remainder.slice(0, slash);
  const restPath = remainder.slice(slash) || '/';
  if (!workspaceId.trim()) return null;
  const decodedWorkspaceId = decodeRouteParam(workspaceId, 'id');
  if (!decodedWorkspaceId.trim()) return null;
  return { workspaceId: decodedWorkspaceId, restPath };
}

function pathToRegex(path: string, keys: string[]): RegExp {
  const pattern = path.replace(/:([A-Za-z0-9_]+)/g, (_, key: string) => {
    keys.push(key);
    return '([^/]+)';
  });
  return new RegExp(`^${pattern}$`);
}
