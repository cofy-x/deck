/**
 * @license
 * Copyright 2026 cofy-x
 * SPDX-License-Identifier: Apache-2.0
 */

import fs from 'node:fs';
import path from 'node:path';

import { DisconnectReason } from '@whiskeysockets/baileys';
import type { Logger } from 'pino';

import type { Config } from '../../../types/index.js';
import { formatError } from '../../../utils.js';
import {
  closeWhatsAppSocket,
  createWhatsAppSocket,
  getStatusCode,
  hasWhatsAppCreds,
  waitForWhatsAppConnection,
} from './whatsapp-session.js';

export interface LoginOptions {
  onStatus?: (message: string) => void;
  timeoutMs?: number;
}

export async function loginWhatsApp(
  config: Config,
  logger: Logger,
  options: LoginOptions = {},
): Promise<void> {
  const authDir = path.resolve(config.whatsappAuthDir);
  const log = logger.child({ channel: 'whatsapp' });
  const timeoutMs = options.timeoutMs ?? 120_000;

  const attemptLogin = async (
    phase: 'initial' | 'restart',
    printQr: boolean,
  ) => {
    const sock = await createWhatsAppSocket({
      authDir,
      logger: log,
      printQr,
      onStatus: options.onStatus,
    });
    try {
      if (phase === 'initial') {
        options.onStatus?.('Waiting for WhatsApp scan...');
      } else {
        options.onStatus?.('Reconnecting WhatsApp session...');
      }
      await waitForWhatsAppConnection(sock, { timeoutMs });
      options.onStatus?.('WhatsApp linked.');
      return { ok: true } as const;
    } catch (error) {
      const statusCode = getStatusCode(error as Error);
      return { ok: false, error: error as Error, statusCode } as const;
    } finally {
      setTimeout(() => closeWhatsAppSocket(sock), 500);
    }
  };

  const initial = await attemptLogin('initial', true);
  if (initial.ok) return;

  if (initial.statusCode === DisconnectReason.loggedOut) {
    options.onStatus?.('WhatsApp logged out. Run: pilot-bridge whatsapp login.');
    throw new Error('WhatsApp logged out');
  }

  const shouldRetry =
    initial.statusCode === 515 ||
    (initial.statusCode === undefined && hasWhatsAppCreds(authDir));

  if (shouldRetry) {
    options.onStatus?.('WhatsApp asked for a restart; retrying connection...');
    const retry = await attemptLogin('restart', false);
    if (retry.ok) return;
    if (retry.statusCode === DisconnectReason.loggedOut) {
      options.onStatus?.('WhatsApp logged out. Run: pilot-bridge whatsapp login.');
    }
    throw new Error(
      `WhatsApp login failed after restart: ${formatError(retry.error)}`,
    );
  }

  if (!initial.statusCode && !hasWhatsAppCreds(authDir)) {
    options.onStatus?.(
      'Timed out waiting for QR scan. Run login again for a fresh QR.',
    );
  }

  throw new Error(`WhatsApp login failed: ${formatError(initial.error)}`);
}

export function unpairWhatsApp(config: Config, logger: Logger): void {
  const authDir = path.resolve(config.whatsappAuthDir);
  if (!fs.existsSync(authDir)) {
    logger.info({ authDir }, 'whatsapp auth directory not found');
    return;
  }
  fs.rmSync(authDir, { recursive: true, force: true });
  logger.info({ authDir }, 'whatsapp auth cleared; run bridge to re-pair');
}
