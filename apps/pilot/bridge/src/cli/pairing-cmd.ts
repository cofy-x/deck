/**
 * @license
 * Copyright 2025 cofy-x
 * SPDX-License-Identifier: Apache-2.0
 */

import type { Command } from 'commander';

import { isChannelName, SUPPORTED_CHANNELS } from '../channel-meta.js';
import { loadConfig } from '../config.js';
import { BridgeStore } from '../db.js';
import type { PairingRow } from '../db.js';
import type { ChannelName } from '../types/index.js';
import { getOpts, outputJson } from './helpers.js';

interface PairingCommandOptions {
  channel?: string;
}

function resolveChannel(raw: string | undefined): ChannelName | null {
  const normalized = raw?.trim().toLowerCase();
  if (!normalized) return null;
  if (isChannelName(normalized)) return normalized;
  return null;
}

function emitError(useJson: boolean, message: string): void {
  if (useJson) {
    outputJson({
      success: false,
      error: message,
    });
  } else {
    console.log(message);
  }
  process.exitCode = 1;
}

function buildAmbiguousMessage(code: string, requests: PairingRow[]): string {
  const choices = requests
    .map((request) => `${request.channel}:${request.peer_id}`)
    .join(', ');
  return `Pairing code ${code} is ambiguous across channels/peers (${choices}). Use --channel <${SUPPORTED_CHANNELS.join('|')}>.`;
}

export function registerPairingCommands(program: Command) {
  const pairing = program.command('pairing').description('Pairing requests');

  pairing
    .command('list')
    .option(
      '--channel <channel>',
      `Filter by channel: ${SUPPORTED_CHANNELS.join(', ')}`,
    )
    .description('List pending pairing requests')
    .action((options: PairingCommandOptions) => {
      const useJson = getOpts(program).json;
      const channel = resolveChannel(options.channel);
      if (options.channel && !channel) {
        emitError(
          useJson,
          `Invalid channel: ${options.channel}. Must be one of: ${SUPPORTED_CHANNELS.join(', ')}.`,
        );
        return;
      }
      const config = loadConfig(process.env, { requireOpencode: false });
      const store = new BridgeStore(config.dbPath);
      store.prunePairingRequests();
      const requests = store.listPairingRequests(channel ?? undefined);
      store.close();

      if (useJson) {
        outputJson(
          requests.map((r) => ({
            code: r.code,
            peerId: r.peer_id,
            channel: r.channel,
            createdAt: new Date(r.created_at).toISOString(),
            expiresAt: new Date(r.expires_at).toISOString(),
          })),
        );
      } else {
        if (!requests.length) {
          console.log('No pending pairing requests.');
        } else {
          for (const request of requests) {
            console.log(
              `${request.code} ${request.channel} ${request.peer_id}`,
            );
          }
        }
      }
    });

  pairing
    .command('approve')
    .argument('<code>', 'Pairing code to approve')
    .option(
      '--channel <channel>',
      `Target channel: ${SUPPORTED_CHANNELS.join(', ')}`,
    )
    .description('Approve a pairing request')
    .action((code: string, options: PairingCommandOptions) => {
      const useJson = getOpts(program).json;
      const resolvedChannel = resolveChannel(options.channel);
      if (options.channel && !resolvedChannel) {
        emitError(
          useJson,
          `Invalid channel: ${options.channel}. Must be one of: ${SUPPORTED_CHANNELS.join(', ')}.`,
        );
        return;
      }
      const config = loadConfig(process.env, { requireOpencode: false });
      const store = new BridgeStore(config.dbPath);
      store.prunePairingRequests();
      const normalizedCode = code.trim();
      let targetChannel = resolvedChannel;

      if (!targetChannel) {
        const matches = store.findPairingRequestsByCode(normalizedCode);
        if (matches.length === 0) {
          store.close();
          emitError(useJson, 'Pairing code not found or expired.');
          return;
        }
        if (matches.length > 1) {
          store.close();
          emitError(useJson, buildAmbiguousMessage(normalizedCode, matches));
          return;
        }
        targetChannel = matches[0]?.channel;
      }

      const request = targetChannel
        ? store.approvePairingRequest(targetChannel, normalizedCode)
        : null;

      if (!request) {
        store.close();
        emitError(useJson, 'Pairing code not found or expired.');
        return;
      }

      store.allowPeer(request.channel, request.peer_id);
      store.close();

      if (useJson) {
        outputJson({
          success: true,
          peerId: request.peer_id,
          channel: request.channel,
        });
      } else {
        console.log(`Approved ${request.peer_id}`);
      }
    });

  pairing
    .command('deny')
    .argument('<code>', 'Pairing code to deny')
    .option(
      '--channel <channel>',
      `Target channel: ${SUPPORTED_CHANNELS.join(', ')}`,
    )
    .description('Deny a pairing request')
    .action((code: string, options: PairingCommandOptions) => {
      const useJson = getOpts(program).json;
      const resolvedChannel = resolveChannel(options.channel);
      if (options.channel && !resolvedChannel) {
        emitError(
          useJson,
          `Invalid channel: ${options.channel}. Must be one of: ${SUPPORTED_CHANNELS.join(', ')}.`,
        );
        return;
      }
      const config = loadConfig(process.env, { requireOpencode: false });
      const store = new BridgeStore(config.dbPath);
      store.prunePairingRequests();
      const normalizedCode = code.trim();
      let targetChannel = resolvedChannel;

      if (!targetChannel) {
        const matches = store.findPairingRequestsByCode(normalizedCode);
        if (matches.length === 0) {
          store.close();
          emitError(useJson, 'Pairing code not found or expired.');
          return;
        }
        if (matches.length > 1) {
          store.close();
          emitError(useJson, buildAmbiguousMessage(normalizedCode, matches));
          return;
        }
        targetChannel = matches[0]?.channel;
      }

      const ok = targetChannel
        ? store.denyPairingRequest(targetChannel, normalizedCode)
        : false;
      store.close();

      if (useJson) {
        outputJson({
          success: ok,
          message: ok ? 'Pairing request removed' : 'Pairing code not found',
        });
      } else {
        console.log(
          ok ? 'Removed pairing request.' : 'Pairing code not found.',
        );
      }
      process.exitCode = ok ? 0 : 1;
    });
}
