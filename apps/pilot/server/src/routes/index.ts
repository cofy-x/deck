/**
 * @license
 * Copyright 2026 cofy-x
 * SPDX-License-Identifier: Apache-2.0
 */

import type { ServerConfig } from '../types/index.js';
import type { Route } from '../http/router.js';
import { registerHealthRoutes } from './health.routes.js';
import { registerConfigRoutes } from './config.routes.js';
import { registerPluginRoutes } from './plugin.routes.js';
import { registerMcpRoutes } from './mcp.routes.js';
import { registerSkillRoutes } from './skill.routes.js';
import { registerCommandRoutes } from './command.routes.js';
import { registerSchedulerRoutes } from './scheduler.routes.js';
import { registerApprovalRoutes } from './approval.routes.js';
import { registerBridgeRoutes } from './bridge.routes.js';

export function createRoutes(config: ServerConfig): Route[] {
  const routes: Route[] = [];
  registerHealthRoutes(routes, config);
  registerConfigRoutes(routes, config);
  registerPluginRoutes(routes, config);
  registerMcpRoutes(routes, config);
  registerSkillRoutes(routes, config);
  registerCommandRoutes(routes, config);
  registerSchedulerRoutes(routes, config);
  registerApprovalRoutes(routes);
  registerBridgeRoutes(routes, config);
  return routes;
}
