/**
 * @license
 * Copyright 2025 cofy-x
 * SPDX-License-Identifier: Apache-2.0
 */

import type { Command } from 'commander';

import { loadConfig } from '../config.js';
import type { ConfigFile } from '../types/index.js';
import { getOpts, outputJson, updateConfig } from './helpers.js';

interface EmailCredentialsOptions {
  imapPort?: string;
  smtpPort?: string;
  imapSecure?: boolean;
  smtpSecure?: boolean;
  from?: string;
}

export function registerEmailCommands(program: Command) {
  const email = program.command('email').description('Email helpers');

  email
    .command('status')
    .description('Show Email status')
    .action(() => {
      const useJson = getOpts(program).json;
      const config = loadConfig(process.env, { requireOpencode: false });
      const configured = Boolean(
        config.emailImapHost &&
          config.emailImapUser &&
          config.emailImapPassword &&
          config.emailSmtpHost &&
          config.emailSmtpUser &&
          config.emailSmtpPassword,
      );

      if (useJson) {
        outputJson({
          configured,
          enabled: config.emailEnabled,
          imapHost: config.emailImapHost ?? null,
          smtpHost: config.emailSmtpHost ?? null,
          pollIntervalSeconds: config.emailPollIntervalSeconds,
        });
      } else {
        console.log(`Email configured: ${configured ? 'yes' : 'no'}`);
        console.log(`Email enabled: ${config.emailEnabled ? 'yes' : 'no'}`);
      }
    });

  email
    .command('set-credentials')
    .argument('<imapHost>', 'IMAP host')
    .argument('<imapUser>', 'IMAP username')
    .argument('<imapPassword>', 'IMAP password')
    .argument('<smtpHost>', 'SMTP host')
    .argument('<smtpUser>', 'SMTP username')
    .argument('<smtpPassword>', 'SMTP password')
    .option('--imap-port <port>', 'IMAP port', '993')
    .option('--smtp-port <port>', 'SMTP port', '587')
    .option('--imap-secure', 'IMAP secure transport', true)
    .option('--smtp-secure', 'SMTP secure transport', false)
    .option('--from <address>', 'From address')
    .description('Set Email IMAP/SMTP credentials')
    .action(
      (
        imapHost: string,
        imapUser: string,
        imapPassword: string,
        smtpHost: string,
        smtpUser: string,
        smtpPassword: string,
        options: EmailCredentialsOptions,
      ) => {
        const useJson = getOpts(program).json;
        const config = loadConfig(process.env, { requireOpencode: false });

        const imapPort = Number.parseInt(options.imapPort ?? '993', 10);
        const smtpPort = Number.parseInt(options.smtpPort ?? '587', 10);

        updateConfig(config.configPath, (cfg) => {
          const next: ConfigFile = { ...cfg };
          next.channels = next.channels ?? {};
          next.channels.email = {
            ...next.channels.email,
            enabled: true,
            imapHost,
            imapUser,
            imapPassword,
            imapPort: Number.isFinite(imapPort) ? imapPort : 993,
            imapSecure: Boolean(options.imapSecure),
            smtpHost,
            smtpUser,
            smtpPassword,
            smtpPort: Number.isFinite(smtpPort) ? smtpPort : 587,
            smtpSecure: Boolean(options.smtpSecure),
            ...(options.from?.trim() ? { fromAddress: options.from.trim() } : {}),
          };
          return next;
        });

        if (useJson) {
          outputJson({ success: true, message: 'Email credentials saved' });
        } else {
          console.log('Email credentials saved.');
        }
      },
    );
}
