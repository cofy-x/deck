# Pilot Bridge

Multi-channel bridge for a running OpenCode server.

Supported adapters:

- WhatsApp
- Telegram
- Slack
- Feishu
- Discord
- DingTalk
- Email
- Mochat
- QQ

## Install + Run (WhatsApp)

One-command install (recommended):

```bash
curl -fsSL https://raw.githubusercontent.com/cofy-x/deck/main/hack/install-pilot-bridge.sh | bash
```

Or install from npm:

```bash
npm install -g pilot-bridge
```

Quick run without install:

```bash
npx pilot-bridge
```

Then follow the guided setup (choose what to configure, link WhatsApp, start).

1. One-command setup (installs deps, builds, creates `.env` if missing):

```bash
pnpm -C apps/pilot/bridge setup
```

2. (Optional) Fill in `apps/pilot/bridge/.env` (see `.env.example`).

Required:

- `OPENCODE_URL`
- `OPENCODE_DIRECTORY`
- `WHATSAPP_AUTH_DIR`

Recommended:

- `OPENCODE_SERVER_USERNAME`
- `OPENCODE_SERVER_PASSWORD`

3. Run pilot-bridge and follow the guided setup:

```bash
pilot-bridge
```

Pilot bridge keeps the WhatsApp session alive once connected.

6. Pair a user with the bot (only if channel access policy is `pairing`):

- Run `pilot-bridge pairing list [--channel <channel>]` to view pending codes.
- Approve a code: `pilot-bridge pairing approve <code> [--channel <channel>]`.
- The user can then message again to receive OpenCode replies.

## Usage Flows

### One-person flow (personal testing)

Use your own WhatsApp account as the bot and test from a second number you control.

1. Run `pilot-bridge` and choose “personal number.”
2. Scan the QR when prompted.
3. Message yourself or from a second number; your number is already allowlisted.

Note: WhatsApp’s “message yourself” thread is not reliable for bot testing.

### Two-person flow (dedicated bot)

Use a separate WhatsApp number as the bot account so it stays independent from your personal chat history.

1. Create a new WhatsApp account for the dedicated number.
2. Run `pilot-bridge` and choose “dedicated number.”
3. Scan the QR when prompted.
4. If access policy is pairing, approve codes with `pilot-bridge pairing approve <code>`.

## Telegram (Untested)

Telegram support is wired but not E2E tested yet. To try it:

- Run `pilot-bridge telegram set-token <token>`.
- Or set `TELEGRAM_BOT_TOKEN` and `TELEGRAM_ENABLED=true`.

## Slack (Socket Mode)

Slack support uses Socket Mode and replies in threads when @mentioned in channels.

1. Create a Slack app.
2. Enable Socket Mode and generate an app token (`xapp-...`).
3. Add bot token scopes:
   - `chat:write`
   - `app_mentions:read`
   - `im:history`
4. Subscribe to events (bot events):
   - `app_mention`
   - `message.im`
5. Set env vars (or save via `pilot-bridge slack set-tokens ...`):
   - `SLACK_BOT_TOKEN=xoxb-...`
   - `SLACK_APP_TOKEN=xapp-...`
   - `SLACK_ENABLED=true`

## Additional Channels

Use channel-specific helpers to configure new adapters:

- `pilot-bridge feishu status`, `pilot-bridge feishu set-webhook <url>`
- `pilot-bridge discord status`, `pilot-bridge discord set-token <token>`
- `pilot-bridge dingtalk status`, `pilot-bridge dingtalk set-webhook <url>`, `pilot-bridge dingtalk set-sign-secret <secret>`, `pilot-bridge dingtalk set-verification-token <token>`
- `pilot-bridge email status`, `pilot-bridge email set-credentials ...`
- `pilot-bridge mochat status`, `pilot-bridge mochat set-token <token>`
- `pilot-bridge qq status`, `pilot-bridge qq set-api <baseUrl> [accessToken]`

For a full DingTalk setup walkthrough, see:

- `docs/design/pilot/dingtalk-setup.md`

## Proxy

When the runtime network requires an outbound proxy, set standard env vars:

### Global Proxy Env

- `HTTPS_PROXY` / `HTTP_PROXY` / `ALL_PROXY`
- `NO_PROXY` for bypass hosts

### Channel Coverage

Bridge adapters that currently use these vars include Telegram, Slack, WhatsApp, and Discord.

### Discord Proxy

Discord uses proxy routing for both REST API calls and the Gateway WebSocket handshake.

Discord-specific overrides:

- `DISCORD_GATEWAY_PROXY_URL`: force proxy URL for Gateway websocket only (for example `socks5://127.0.0.1:7890`).
- `DISCORD_GATEWAY_HANDSHAKE_TIMEOUT_MS`: override Gateway handshake timeout; defaults to `120000` when gateway proxy is enabled.

### Discord Gateway Patch Mechanism

- Bridge keeps `discord.js` and applies a temporary `ws.WebSocket` patch only during `discord.js` runtime loading.
- `@discordjs/ws` currently does not expose a gateway WebSocket `agent` injection point, so changing proxy libraries alone cannot remove this patch step.
- The patch is scoped to `gateway.discord.gg` and restored immediately after import, so Slack and other channels are not affected by long-lived global patching.

## Discord Troubleshooting

### No Response in Group

- `GROUPS_ENABLED=true` if you want to handle non-DM traffic.
- In guilds/channels, ensure the bot is mentioned when `DISCORD_MENTION_IN_GUILDS=true`.
- Confirm the Discord application has required intents enabled, especially `Message Content Intent` and message events for the target context.
- Check bridge logs for debug reasons: `groups disabled`, `empty content`, `bot not mentioned`, `empty after removing mention`.

## Access Policies

Each channel has an access policy:

- `open`: allow inbound directly.
- `allowlist`: only allowlisted identities can chat.
- `pairing`: first message gets a pairing code; owner approves by CLI.
- `disabled`: deny inbound.

Defaults:

- WhatsApp: `pairing`
- Other channels: `open`

Pairing-supported channels:

- WhatsApp
- Telegram
- Slack
- Discord
- Email
- QQ

Pairing-unsupported channels (`pairing` falls back to `allowlist`):

- Feishu
- DingTalk
- Mochat

Config options:

- Per-channel in `bridge.json`: `channels.<channel>.accessPolicy`
- Env override: `ACCESS_POLICY_<CHANNEL>` (for example `ACCESS_POLICY_SLACK=allowlist`)

## Commands

```bash
pilot-bridge
pilot-bridge whatsapp login
pilot-bridge whatsapp qr
pilot-bridge whatsapp logout
pilot-bridge telegram set-token <token>
pilot-bridge telegram set-thinking-mode <off|summary|raw_debug>
pilot-bridge feishu status
pilot-bridge discord status
pilot-bridge dingtalk status
pilot-bridge dingtalk set-sign-secret <secret>
pilot-bridge dingtalk set-verification-token <token>
pilot-bridge email status
pilot-bridge mochat status
pilot-bridge qq status
pilot-bridge slack status
pilot-bridge slack set-tokens <xoxb> <xapp>
pilot-bridge pairing list [--channel <channel>]
pilot-bridge pairing approve <code> [--channel <channel>]
pilot-bridge pairing deny <code> [--channel <channel>]
pilot-bridge status
```

## Defaults

- SQLite at `~/.deck/pilot/bridge/bridge.db` unless overridden.
- Config stored at `~/.deck/pilot/bridge/bridge.json` (created by `pilot-bridge`).
- WhatsApp access policy defaults to `pairing`; other channels default to `open`.
- Group chats are disabled unless `GROUPS_ENABLED=true`.

## Tests

```bash
pnpm -C apps/pilot/bridge test:smoke
```
