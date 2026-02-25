/**
 * @license
 * Copyright 2025 cofy-x
 * SPDX-License-Identifier: Apache-2.0
 */

import type { Command } from 'commander';

import { ConfigFileSchema } from '../config-schema.js';
import { loadConfig, readConfigFile } from '../config.js';
import {
  getNestedValue,
  outputJson,
  parseConfigValue,
  setNestedValue,
  toJsonObject,
  updateConfig,
} from './helpers.js';
import { runCommand } from './command-runner.js';

export function registerConfigCommands(program: Command) {
  const configCmd = program
    .command('config')
    .description('Manage configuration');

  configCmd
    .command('get')
    .argument(
      '[key]',
      'Config key to get (dot notation, e.g., channels.whatsapp.accessPolicy)',
    )
    .description('Get config value(s)')
    .action((key?: string) =>
      runCommand(program, async ({ useJson }) => {
        const config = loadConfig(process.env, { requireOpencode: false });
        const { config: configFile } = readConfigFile(config.configPath);
        const configObj = toJsonObject(
          structuredClone(configFile),
          'config get command payload',
        );

        if (key) {
          const value = getNestedValue(configObj, key);
          if (useJson) {
            outputJson({ [key]: value });
          } else {
            if (value === undefined) {
              console.log(`${key}: (not set)`);
            } else if (typeof value === 'object') {
              console.log(`${key}: ${JSON.stringify(value, null, 2)}`);
            } else {
              console.log(`${key}: ${String(value)}`);
            }
          }
        } else if (useJson) {
          outputJson(configObj);
        } else {
          console.log(JSON.stringify(configFile, null, 2));
        }
      }),
    );

  configCmd
    .command('set')
    .argument('<key>', 'Config key to set (dot notation)')
    .argument('<value>', 'Value to set (JSON for arrays/objects)')
    .description('Set config value')
    .action((key: string, value: string) =>
      runCommand(program, async ({ useJson }) => {
        const config = loadConfig(process.env, { requireOpencode: false });

        const parsedValue = parseConfigValue(value);
        const updated = updateConfig(config.configPath, (cfg) => {
          const next = toJsonObject(
            structuredClone(cfg),
            'config set command payload',
          );
          setNestedValue(next, key, parsedValue);
          return ConfigFileSchema.parse(next);
        });

        if (useJson) {
          const updatedObj = toJsonObject(
            structuredClone(updated),
            'config set command response',
          );
          outputJson({
            success: true,
            key,
            value: parsedValue,
            config: updatedObj,
          });
        } else {
          console.log(`Set ${key} = ${JSON.stringify(parsedValue)}`);
        }
      }),
    );
}
