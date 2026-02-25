# DingTalk Setup Guide for Pilot Bridge

This guide explains how to configure DingTalk custom robots with `pilot-bridge`.

## Scope

This guide applies to:

- `apps/pilot/bridge`
- DingTalk custom robot webhook + callback mode

## Prerequisites

- A running `pilot-bridge` instance reachable from the public internet.
- A DingTalk custom robot created in the target group.
- OpenCode and bridge runtime already working.

## Configure DingTalk Side

In DingTalk custom robot settings:

1. Configure outbound robot webhook (for bridge -> DingTalk sends).
2. Configure callback URL (for DingTalk -> bridge inbound events).
3. Configure callback token.
4. Enable one security method for outbound webhook. If your org requires signature mode, use "Sign" and keep the secret.

Important:

- Callback URL must include your bridge event path.
- Example callback URL:
  - `http://your-domain:13012/events/dingtalk`
- Do not use only the domain root (for example `http://your-domain:13012`) if bridge path is `/events/dingtalk`.

## Configure Bridge Side

### Option A: CLI (recommended)

```bash
pilot-bridge dingtalk set-webhook <webhookUrl>
pilot-bridge dingtalk set-sign-secret <signSecret>
pilot-bridge dingtalk set-verification-token <token>
```

Check status:

```bash
pilot-bridge dingtalk status
```

### Option B: Environment variables

Set these in `apps/pilot/bridge/.env` (or your runtime env):

```bash
DINGTALK_WEBHOOK_URL=https://oapi.dingtalk.com/robot/send?access_token=...
DINGTALK_SIGN_SECRET=SEC...
DINGTALK_VERIFICATION_TOKEN=...
DINGTALK_EVENT_PORT=3012
DINGTALK_EVENT_PATH=/events/dingtalk
DINGTALK_ENABLED=true
```

## Network / Proxy Mapping

If public URL and bridge runtime are on different ports, ensure your reverse proxy maps correctly.

Example:

- Public callback URL: `http://your-domain:13012/events/dingtalk`
- Internal bridge listener: `0.0.0.0:3012/events/dingtalk`

Both path and method must match exactly (`POST` + configured path).

## Verify End-to-End

1. Send a test message with bridge CLI:

```bash
pnpm exec pilot-bridge send --channel dingtalk --to <peerId> --message "hello"
```

2. In DingTalk group, @ the robot with a command, for example `/reset`.
3. Confirm bridge logs show inbound payload events.
4. Confirm bridge sends a reply back to DingTalk.

## Troubleshooting

### Symptom: outbound works, inbound does not

Most common causes:

- Callback URL path mismatch (`/` vs `/events/dingtalk`).
- Callback token mismatch.
- Reverse proxy not forwarding to bridge event port/path.
- Bridge not started with DingTalk enabled.

### Symptom: token verification failed

- Re-check `DINGTALK_VERIFICATION_TOKEN` and DingTalk callback token.
- Re-apply with:

```bash
pilot-bridge dingtalk set-verification-token <token>
```

### Symptom: no logs for inbound requests

- Verify public callback URL reaches your bridge host.
- Temporarily set `LOG_LEVEL=debug` and inspect webhook logs.

## Notes

- Current bridge behavior uses configured `DINGTALK_WEBHOOK_URL` for outbound text sends.
- Inbound payload fields may evolve over time; bridge keeps schema compatibility for extra fields.
