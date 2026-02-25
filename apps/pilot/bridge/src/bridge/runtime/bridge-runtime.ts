/**
 * @license
 * Copyright 2026 cofy-x
 * SPDX-License-Identifier: Apache-2.0
 */

import type { Logger } from 'pino';

import type {
  BridgeDeps,
  BridgeInstance,
  BridgeReporter,
  Config,
} from '../../types/index.js';
import { startBridge } from './bridge.js';

export class BridgeRuntime {
  constructor(
    private readonly config: Config,
    private readonly logger: Logger,
    private readonly reporter?: BridgeReporter,
    private readonly deps: BridgeDeps = {},
  ) {}

  async start(): Promise<BridgeInstance> {
    return startBridge(this.config, this.logger, this.reporter, this.deps);
  }
}
