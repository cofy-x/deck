/**
 * @license
 * Copyright 2025 cofy-x
 * SPDX-License-Identifier: Apache-2.0
 */

import fs from 'node:fs';
import path from 'node:path';

import pino from 'pino';

export interface LoggerOptions {
  logFile?: string;
}

export function createLogger(level: string, options?: LoggerOptions) {
  if (options?.logFile) {
    fs.mkdirSync(path.dirname(options.logFile), { recursive: true });
    const destination = pino.destination({
      dest: options.logFile,
      sync: false,
    });
    return pino({ level, base: undefined }, destination);
  }

  return pino({
    level,
    base: undefined,
  });
}
