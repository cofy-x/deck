/**
 * @license
 * Copyright 2026 cofy-x
 * SPDX-License-Identifier: Apache-2.0
 */

export {
  createOpencodeSdkClient,
  fetchBridgeHealth,
  waitForBridgeHealthy,
  waitForOpencodeHealthy,
} from './services/health.js';
export { startBridge, startOpencode, startPilotServer } from './services/spawn.js';
export {
  verifyBridgeVersion,
  verifyOpencodeVersion,
  verifyPilotServer,
} from './services/verify.js';
export { runChecks } from './services/checks.js';
export type { OpencodeClient } from './services/health.js';
