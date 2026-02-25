/**
 * @license
 * Copyright 2026 cofy-x
 * SPDX-License-Identifier: Apache-2.0
 */

import { readConfigFile, writeConfigFile } from '../../../config.js';
import type { Config, ConfigFile } from '../../../types/index.js';

export interface HealthConfigStoreLike {
  persist(mutator: (current: ConfigFile) => ConfigFile): ConfigFile;
}

export class HealthConfigStore implements HealthConfigStoreLike {
  constructor(private readonly config: Config) {}

  persist(mutator: (current: ConfigFile) => ConfigFile): ConfigFile {
    const { config: current } = readConfigFile(this.config.configPath);
    const next = mutator(current);
    next.version = next.version ?? 1;
    writeConfigFile(this.config.configPath, next);
    this.config.configFile = next;
    return next;
  }
}
