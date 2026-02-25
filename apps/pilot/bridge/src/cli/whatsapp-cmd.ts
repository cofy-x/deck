/**
 * @license
 * Copyright 2025 cofy-x
 * SPDX-License-Identifier: Apache-2.0
 */

import { Buffer } from 'node:buffer';

import type { Command } from 'commander';
import * as qrcodeTerminal from 'qrcode-terminal';

import {
  closeWhatsAppSocket,
  createWhatsAppSocket,
  hasWhatsAppCreds,
  loginWhatsApp,
  unpairWhatsApp,
} from '../adapters/index.js';
import { formatError } from '../utils.js';
import { loadConfig } from '../config.js';
import type { Config } from '../types/index.js';
import { createAppLogger, getOpts, outputJson } from './helpers.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface QrOptions {
  format?: string;
}

// ---------------------------------------------------------------------------
// QR code generation for non-interactive use
// ---------------------------------------------------------------------------

async function getWhatsAppQr(
  config: Config,
  format: 'ascii' | 'base64',
): Promise<string> {
  const logger = createAppLogger(config);

  return new Promise((resolve, reject) => {
    let resolved = false;
    const timeout = setTimeout(() => {
      if (!resolved) {
        resolved = true;
        reject(new Error('Timeout waiting for QR code'));
      }
    }, 30000);

    void createWhatsAppSocket({
      authDir: config.whatsappAuthDir,
      logger,
      printQr: false,
      onQr: (qr) => {
        if (resolved) return;
        resolved = true;
        clearTimeout(timeout);

        if (format === 'base64') {
          resolve(Buffer.from(qr).toString('base64'));
        } else {
          resolve(qr);
        }
      },
    })
      .then((sock) => {
        setTimeout(
          () => {
            closeWhatsAppSocket(sock);
          },
          resolved ? 500 : 30500,
        );
      })
      .catch((err) => {
        if (!resolved) {
          resolved = true;
          clearTimeout(timeout);
          reject(err);
        }
      });
  });
}

// ---------------------------------------------------------------------------
// Command registration
// ---------------------------------------------------------------------------

export function registerWhatsAppCommands(program: Command) {
  const whatsapp = program.command('whatsapp').description('WhatsApp helpers');

  whatsapp
    .command('status')
    .description('Show WhatsApp status')
    .action(() => {
      const useJson = getOpts(program).json;
      const config = loadConfig(process.env, { requireOpencode: false });
      const linked = hasWhatsAppCreds(config.whatsappAuthDir);

      if (useJson) {
        outputJson({
          linked,
          accessPolicy: config.channelAccessPolicy.whatsapp,
          selfChatMode: config.whatsappSelfChatMode,
          authDir: config.whatsappAuthDir,
          accountId: config.whatsappAccountId,
          allowFrom: [...config.whatsappAllowFrom],
        });
      } else {
        console.log(`WhatsApp linked: ${linked ? 'yes' : 'no'}`);
        console.log(
          `Access policy: ${config.channelAccessPolicy.whatsapp}`,
        );
        console.log(
          `Self chat mode: ${config.whatsappSelfChatMode ? 'yes' : 'no'}`,
        );
        console.log(`Auth dir: ${config.whatsappAuthDir}`);
      }
    });

  whatsapp
    .command('login')
    .description('Login to WhatsApp via QR code')
    .action(async () => {
      const config = loadConfig(process.env, { requireOpencode: false });
      await loginWhatsApp(config, createAppLogger(config), {
        onStatus: console.log,
      });
    });

  whatsapp
    .command('logout')
    .description('Logout of WhatsApp and clear auth state')
    .action(() => {
      const useJson = getOpts(program).json;
      const config = loadConfig(process.env, { requireOpencode: false });
      unpairWhatsApp(config, createAppLogger(config));

      if (useJson) {
        outputJson({ success: true, message: 'WhatsApp auth cleared' });
      } else {
        console.log('WhatsApp auth cleared.');
      }
    });

  whatsapp
    .command('qr')
    .description('Get WhatsApp QR code non-interactively')
    .option('--format <format>', 'Output format: ascii or base64', 'ascii')
    .action(async (opts: QrOptions) => {
      const useJson = getOpts(program).json;
      const config = loadConfig(process.env, { requireOpencode: false });
      const format = (opts.format === 'base64' ? 'base64' : 'ascii') as
        | 'ascii'
        | 'base64';

      if (hasWhatsAppCreds(config.whatsappAuthDir)) {
        if (useJson) {
          outputJson({
            error: "WhatsApp already linked. Use 'whatsapp logout' first.",
          });
        } else {
          console.log("WhatsApp already linked. Use 'whatsapp logout' first.");
        }
        process.exit(1);
      }

      try {
        const qr = await getWhatsAppQr(config, format);

        if (useJson) {
          outputJson({ qr, format });
        } else {
          if (format === 'ascii') {
            qrcodeTerminal.generate(qr, { small: true });
          } else {
            console.log(qr);
          }
        }
      } catch (error) {
        if (useJson) {
          outputJson({ error: formatError(error) });
        } else {
          console.error(`Failed to get QR code: ${formatError(error)}`);
        }
        process.exit(1);
      }
    });
}
