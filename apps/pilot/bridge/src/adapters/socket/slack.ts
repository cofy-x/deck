/**
 * @license
 * Copyright 2025 cofy-x
 * SPDX-License-Identifier: Apache-2.0
 */

import type { Logger } from 'pino';

import { SocketModeClient } from '@slack/socket-mode';
import { WebClient } from '@slack/web-api';

import type { Adapter, Config, MessageHandler } from '../../types/index.js';
import { createProxyAgent, resolveProxyUrl } from '../../utils.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SlackAdapter extends Adapter {
  name: 'slack';
}

export interface SlackDeps {
  WebClient: typeof WebClient;
  SocketModeClient: typeof SocketModeClient;
}

export interface SlackPeer {
  channelId: string;
  threadTs?: string;
}

interface SlackEvent {
  type?: string;
  channel?: string;
  text?: string;
  user?: string;
  bot_id?: string;
  subtype?: string;
  thread_ts?: string;
  ts?: string;
}

interface SocketModeArgs {
  ack?: () => Promise<void>;
  event?: SlackEvent;
}

interface ShouldIgnoreAccepted {
  ok: false;
  channelId: string;
  textRaw: string;
  userId: string | null;
}

interface ShouldIgnoreRejected {
  ok: true;
}

type ShouldIgnoreResult = ShouldIgnoreAccepted | ShouldIgnoreRejected;

// ---------------------------------------------------------------------------
// Peer ID encoding / decoding
// ---------------------------------------------------------------------------

// `peerId` encoding:
// - DMs:   D12345678
// - Threads in channels: C12345678|1700000000.000100
// Using `|` avoids clashing with ALLOW_FROM's channel:peer parsing.
export function formatSlackPeerId(peer: SlackPeer): string {
  if (!peer.threadTs) return peer.channelId;
  return `${peer.channelId}|${peer.threadTs}`;
}

export function parseSlackPeerId(peerId: string): SlackPeer {
  const trimmed = peerId.trim();
  if (!trimmed) return { channelId: '' };
  const [channelId, threadTs] = trimmed.split('|');
  if (channelId && threadTs) return { channelId, threadTs };
  return { channelId: channelId || trimmed };
}

export function stripSlackMention(
  text: string,
  botUserId: string | null,
): string {
  let next = text ?? '';
  if (botUserId) {
    const token = `<@${botUserId}>`;
    next = next.split(token).join(' ');
  }
  next = next.replace(/^\s*[:,-]+\s*/, '');
  return next.trim();
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MAX_TEXT_LENGTH = 39_000;
const SLACK_AUTH_TIMEOUT_MS = 8_000;
const SLACK_SOCKET_START_TIMEOUT_MS = 12_000;

function withTimeout<T>(
  task: Promise<T>,
  timeoutMs: number,
  label: string,
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`${label} timed out after ${timeoutMs}ms`));
    }, timeoutMs);
    task
      .then((value) => {
        clearTimeout(timer);
        resolve(value);
      })
      .catch((error) => {
        clearTimeout(timer);
        reject(error);
      });
  });
}

export class SlackAdapterImpl implements SlackAdapter {
  readonly name = 'slack' as const;

  readonly maxTextLength = MAX_TEXT_LENGTH;

  readonly capabilities = {
    progress: false,
    typing: false,
    file: false,
  } as const;

  private readonly log: Logger;

  private readonly web: WebClient;

  private readonly socket: SocketModeClient;

  private botUserId: string | null = null;

  private started = false;

  private starting = false;

  private startTask: Promise<void> | null = null;

  constructor(
    logger: Logger,
    private readonly onMessage: MessageHandler,
    private readonly slackBotToken: string,
    private readonly slackAppToken: string,
    deps: SlackDeps = { WebClient, SocketModeClient },
  ) {
    this.log = logger.child({ channel: 'slack' });

    const slackApiUrl = 'https://slack.com/api/';
    const proxyUrl = resolveProxyUrl(slackApiUrl);
    const agent = createProxyAgent(slackApiUrl);
    if (proxyUrl) {
      this.log.info({ proxy: proxyUrl }, 'slack using proxy');
    }

    this.web = new deps.WebClient(this.slackBotToken, {
      ...(agent ? { agent } : {}),
    });
    this.socket = new deps.SocketModeClient({
      appToken: this.slackAppToken,
      ...(agent ? { clientOptions: { agent } } : {}),
    });

    this.registerSocketHandlers();
  }

  async start(): Promise<void> {
    if (this.started || this.starting) return;
    this.starting = true;
    this.log.debug('slack adapter starting');

    try {
      const auth = await withTimeout(
        this.web.auth.test(),
        SLACK_AUTH_TIMEOUT_MS,
        'slack auth.test',
      );
      this.botUserId = typeof auth.user_id === 'string' ? auth.user_id : null;
    } catch (error) {
      this.starting = false;
      this.log.error({ error }, 'slack auth failed');
      return;
    }

    this.startTask = withTimeout(
      this.socket.start().then(() => undefined),
      SLACK_SOCKET_START_TIMEOUT_MS,
      'slack socket.start',
    )
      .then(() => {
        this.started = true;
        this.log.info({ botUserId: this.botUserId }, 'slack adapter started');
      })
      .catch((error) => {
        this.log.error({ error }, 'slack adapter start failed');
      })
      .finally(() => {
        this.starting = false;
        if (!this.started) {
          this.startTask = null;
        }
      });

    this.log.info({ botUserId: this.botUserId }, 'slack adapter start initiated');
  }

  async stop(): Promise<void> {
    if (!this.started && !this.starting) return;
    this.starting = false;
    try {
      await this.socket.disconnect();
    } catch (error) {
      this.log.warn({ error }, 'slack adapter stop failed');
    }
    if (this.startTask) {
      await this.startTask.catch(() => undefined);
      this.startTask = null;
    }
    this.started = false;
    this.log.info('slack adapter stopped');
  }

  async sendText(peerId: string, text: string): Promise<void> {
    const peer = parseSlackPeerId(peerId);
    if (!peer.channelId) throw new Error('Invalid Slack peerId');

    await this.web.chat.postMessage({
      channel: peer.channelId,
      text,
      ...(peer.threadTs ? { thread_ts: peer.threadTs } : {}),
    });
  }

  private registerSocketHandlers(): void {
    this.socket.on('message', async (args: SocketModeArgs) => {
      await this.safeAck(args.ack);

      const event = args.event;
      if (!event || typeof event !== 'object') return;
      const filtered = this.shouldIgnore(event);
      if (filtered.ok) return;

      // Only respond to direct messages by default.
      const isDm = filtered.channelId.startsWith('D');
      if (!isDm) return;

      const threadTs = event.thread_ts ?? null;
      const peerId = formatSlackPeerId({
        channelId: filtered.channelId,
        ...(threadTs ? { threadTs } : {}),
      });

      try {
        await this.onMessage({
          channel: 'slack',
          peerId,
          text: filtered.textRaw.trim(),
          raw: event,
        });
      } catch (error) {
        this.log.error({ error, peerId }, 'slack inbound handler failed');
      }
    });

    this.socket.on('app_mention', async (args: SocketModeArgs) => {
      await this.safeAck(args.ack);

      const event = args.event;
      if (!event || typeof event !== 'object') return;
      const filtered = this.shouldIgnore(event);
      if (filtered.ok) return;

      const threadTs = event.thread_ts ?? null;
      const ts = event.ts ?? null;
      const rootThread = threadTs || ts;
      const peerId = formatSlackPeerId({
        channelId: filtered.channelId,
        ...(rootThread ? { threadTs: rootThread } : {}),
      });
      const text = stripSlackMention(filtered.textRaw, this.botUserId);
      if (!text) return;

      try {
        await this.onMessage({
          channel: 'slack',
          peerId,
          text,
          raw: event,
        });
      } catch (error) {
        this.log.error({ error, peerId }, 'slack inbound handler failed');
      }
    });
  }

  private async safeAck(ack: (() => Promise<void>) | undefined): Promise<void> {
    if (!ack) return;
    try {
      await ack();
    } catch (error) {
      this.log.warn({ error }, 'slack ack failed');
    }
  }

  private shouldIgnore(event: SlackEvent): ShouldIgnoreResult {
    const channelId = event.channel ?? '';
    const textRaw = event.text ?? '';
    const userId = event.user ?? null;
    const botId = event.bot_id ?? null;
    const subtype = event.subtype ?? null;

    // Avoid loops / non-user messages.
    if (botId) return { ok: true };
    if (subtype && subtype !== '') return { ok: true };
    if (userId && this.botUserId && userId === this.botUserId) return { ok: true };
    if (!channelId || !textRaw.trim()) return { ok: true };

    return { ok: false, channelId, textRaw, userId };
  }
}

// ---------------------------------------------------------------------------
// Adapter factory
// ---------------------------------------------------------------------------

export function createSlackAdapter(
  config: Config,
  logger: Logger,
  onMessage: MessageHandler,
  deps: SlackDeps = { WebClient, SocketModeClient },
): SlackAdapter {
  const slackBotToken = config.slackBotToken;
  if (!slackBotToken) {
    throw new Error('SLACK_BOT_TOKEN is required for Slack adapter');
  }
  const slackAppToken = config.slackAppToken;
  if (!slackAppToken) {
    throw new Error('SLACK_APP_TOKEN is required for Slack adapter');
  }

  return new SlackAdapterImpl(
    logger,
    onMessage,
    slackBotToken,
    slackAppToken,
    deps,
  );
}
