/**
 * @license
 * Copyright 2026 cofy-x
 * SPDX-License-Identifier: Apache-2.0
 */

import type { Command } from 'commander';

import type { JsonValue } from '../types/index.js';
import { getOpts, outputJson } from './helpers.js';

interface CommandArgument {
  required: boolean;
  syntax: string;
  description: string;
}

export interface ChannelStatusCommandOptions<TStatus extends JsonValue> {
  command: Command;
  program: Command;
  description: string;
  getStatus: () => TStatus;
  printText: (status: TStatus) => void;
}

export function registerChannelStatusCommand<TStatus extends JsonValue>(
  options: ChannelStatusCommandOptions<TStatus>,
): void {
  options.command
    .command('status')
    .description(options.description)
    .action(() => {
      const useJson = getOpts(options.program).json;
      const status = options.getStatus();
      if (useJson) {
        outputJson(status);
      } else {
        options.printText(status);
      }
    });
}

export interface ChannelConfigSetCommandOptions<TResult> {
  command: Command;
  program: Command;
  name: string;
  description: string;
  arguments: CommandArgument[];
  run: (...args: string[]) => TResult | Promise<TResult>;
  toJson: (result: TResult) => JsonValue;
  toText: (result: TResult) => string;
}

export function registerChannelConfigSetCommand<TResult>(
  options: ChannelConfigSetCommandOptions<TResult>,
): void {
  let command = options.command.command(options.name).description(options.description);
  for (const argument of options.arguments) {
    command = argument.required
      ? command.argument(`<${argument.syntax}>`, argument.description)
      : command.argument(`[${argument.syntax}]`, argument.description);
  }

  command.action(async (...rawArgs: unknown[]) => {
    const useJson = getOpts(options.program).json;
    const args = rawArgs.slice(0, options.arguments.length).map((value) =>
      String(value),
    );
    const result = await options.run(...args);
    if (useJson) {
      outputJson(options.toJson(result));
    } else {
      console.log(options.toText(result));
    }
  });
}
