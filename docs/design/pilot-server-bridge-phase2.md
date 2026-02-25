# Pilot Server Bridge Phase 2 Design

> Status: **Proposed**.

## Summary

This document defines a decision-complete Phase 2 extension for `apps/pilot/server` bridge APIs, so remote clients can manage newly added bridge adapters (`feishu`, `discord`, `dingtalk`, `email`, `mochat`, `qq`) with approval/audit controls.

Phase 2 is intentionally scoped to `apps/pilot/server` and does not require `apps/client` or `apps/pilot/host` changes.

## Current State

- `pilot-bridge` now supports 9 channels in runtime and health output.
- `pilot-host` can now read bridge health with 9-channel compatibility.
- `pilot-server` currently exposes only two bridge write routes:
  - `POST /workspace/:id/bridge/telegram-token`
  - `POST /workspace/:id/bridge/slack-tokens`
- Existing server routes use approval workflow and audit logging, then call bridge health-server config endpoints.

## Goals

- Add server-side API coverage for new bridge adapters:
  - `feishu`, `discord`, `dingtalk`, `email`, `mochat`, `qq`
- Preserve approval and audit guarantees for all bridge config writes.
- Keep strict TypeScript and avoid `any`/`unknown` in new code.
- Keep compatibility with existing Telegram/Slack routes and payloads.

## Non-Goals

- No UI implementation in `apps/client`.
- No lifecycle control changes in `apps/pilot/host`.
- No automatic bridge process restart from `pilot-server`.
- No advanced adapter behavior (attachments, rich cards, batching, etc.).

## Scope

- `apps/pilot/server/src/routes/bridge.routes.ts`
- `apps/pilot/server/src/services/bridge.service.ts`
- `apps/pilot/server/src/types/*` (only if needed for new response/input types)
- `apps/pilot/server/README.md`
- Tests under `apps/pilot/server/src/**/*.test.ts`

## Public API Additions

All new write routes require `client` auth and approval gate (same as existing bridge routes).

1. `POST /workspace/:id/bridge/feishu-webhook`
- Body:
  - `webhookUrl` required string
  - `verificationToken` optional string
  - `eventPort` optional number (1..65535)
  - `eventPath` optional string
  - `enabled` optional boolean (default `true`)

2. `POST /workspace/:id/bridge/discord-token`
- Body:
  - `token` required string
  - `mentionInGuilds` optional boolean (default `true`)
  - `enabled` optional boolean (default `true`)

3. `POST /workspace/:id/bridge/dingtalk-webhook`
- Body:
  - `webhookUrl` required string
  - `verificationToken` optional string
  - `eventPort` optional number (1..65535)
  - `eventPath` optional string
  - `enabled` optional boolean (default `true`)

4. `POST /workspace/:id/bridge/email-credentials`
- Body:
  - `imapHost` required string
  - `imapPort` optional number (1..65535, default `993`)
  - `imapSecure` optional boolean (default `true`)
  - `imapUser` required string
  - `imapPassword` required string
  - `imapMailbox` optional string (default `INBOX`)
  - `pollIntervalSeconds` optional number (>= 5, default `30`)
  - `smtpHost` required string
  - `smtpPort` optional number (1..65535, default `587`)
  - `smtpSecure` optional boolean (default `false`)
  - `smtpUser` required string
  - `smtpPassword` required string
  - `fromAddress` optional string
  - `subjectPrefix` optional string (default `Re: `)
  - `autoReplyEnabled` optional boolean (default `true`)
  - `enabled` optional boolean (default `true`)

5. `POST /workspace/:id/bridge/mochat-token`
- Body:
  - `clawToken` required string
  - `baseUrl` optional string (default `https://mochat.io`)
  - `sessions` optional string[]
  - `pollIntervalMs` optional number (>= 1000, default `30000`)
  - `watchTimeoutMs` optional number (>= 1000, default `25000`)
  - `watchLimit` optional number (>= 1, default `100`)
  - `enabled` optional boolean (default `true`)

6. `POST /workspace/:id/bridge/qq-api`
- Body:
  - `apiBaseUrl` required string
  - `accessToken` optional string
  - `webhookPort` optional number (1..65535, default `3013`)
  - `webhookPath` optional string (default `/events/qq`)
  - `enabled` optional boolean (default `true`)

7. `GET /workspace/:id/bridge/health` (read-only proxy)
- Query:
  - `healthPort` optional number override (same semantics as existing write routes)
- Response:
  - normalized bridge health snapshot with 9 channels
  - shape aligned with bridge `/health`

## Compatibility Strategy

- Keep existing Telegram/Slack routes unchanged.
- Additive routes only; no breaking path or payload changes.
- New channel writes update bridge config file directly and return:
  - `{ ok: true, updated: true, requiresRestart: true }`
- Telegram/Slack keep current live-update behavior through bridge config endpoints.
- `GET /workspace/:id/bridge/health` must tolerate bridge legacy 3-channel payloads:
  - missing new channels are normalized to `false`.

## Internal Design Decisions

### 1) Config Update Path

For new channels, `pilot-server` writes `bridge.json` directly (same path resolved by `resolveBridgeConfigPath()`), because bridge health-server currently exposes mutating endpoints only for Telegram/Slack/groups.

Implementation details:
- Read existing `bridge.json` if present; otherwise create a minimal default:
  - `{ "version": 1, "channels": {} }`
- Merge updates into `channels.<channel>` only.
- Preserve unrelated top-level and channel fields.
- Write atomically via temp file + rename.

### 2) Approval and Audit

Each new route must:
- call `requireApproval(...)` before update
- emit `recordAudit(...)` with stable action/target names:
  - `bridge.feishu.set-webhook`
  - `bridge.discord.set-token`
  - `bridge.dingtalk.set-webhook`
  - `bridge.email.set-credentials`
  - `bridge.mochat.set-token`
  - `bridge.qq.set-api`

### 3) Health Proxy

Add `fetchBridgeHealth(...)` in `bridge.service.ts`:
- GET `http://{host}:{port}/health`
- normalize payload to 9 channels
- return structured JSON object
- map errors to existing `ApiError` patterns:
  - `bridge_unreachable`
  - `bridge_request_failed`

### 4) Validation Rules

Validation uses explicit typed guards and parser helpers (no `any`/`unknown`):
- required strings must be non-empty after trim
- numeric ports must be integer in `1..65535`
- intervals and limits must satisfy minimum constraints above
- array fields (`sessions`) must be array of non-empty strings

### 5) DRY Structure

Use route-local helper factories to reduce repetition:
- `resolveBridgeWriteContext(...)`
- `requireBridgeApprovalAndAudit(...)`
- `normalizeBridgePort(...)`
- per-channel parsers returning typed payload objects

## File-Level Implementation Plan

1. `apps/pilot/server/src/services/bridge.service.ts`
- add typed bridge config read/merge/write helpers
- add channel-specific write functions for six new adapters
- add bridge health fetch + normalize function
- keep existing Telegram/Slack functions intact

2. `apps/pilot/server/src/routes/bridge.routes.ts`
- register six new POST routes
- register one new GET health route
- use shared helpers for approval/audit/error mapping

3. `apps/pilot/server/README.md`
- add new bridge endpoints and brief route purpose notes

4. `apps/pilot/server/src/types/*` (if required)
- add strongly typed interfaces for new route payloads/responses

## Test Plan

### Unit Tests

1. `bridge.service` config merge tests
- creates default config when file missing
- merges channel config without clobbering unrelated fields
- validates and rejects malformed payload values

2. `bridge.service` health normalize tests
- parses full 9-channel health payload
- parses legacy 3-channel health payload and fills missing channels as `false`
- throws for invalid schema (wrong field types)

### Route Tests

1. New POST routes
- missing required fields -> `400`
- approval denied -> `403`
- successful write -> `200`, `requiresRestart: true`
- audit record action/target correctness

2. New GET `/workspace/:id/bridge/health`
- healthy bridge response passthrough with normalization
- bridge unreachable -> `502 bridge_unreachable`
- non-2xx bridge response -> mapped `bridge_request_failed`

## Acceptance Criteria

- `pnpm -C apps/pilot/server typecheck` passes
- `pnpm -C apps/pilot/server test` passes with new coverage for bridge routes/services
- Existing Telegram/Slack routes remain behavior-compatible
- New routes can update config for all six new channels
- Health route returns a normalized 9-channel snapshot

## Rollout

1. Land server changes behind additive routes only.
2. Update docs and communicate new endpoints to client/automation maintainers.
3. Optional Phase 3:
- extend bridge health-server with live config endpoints for new channels
- switch new server write routes from config-file patch to live apply where available

## Assumptions

- Bridge config file path remains `resolveBridgeConfigPath()`-compatible.
- Bridge process reads `bridge.json` on start, so file updates are effective after restart.
- Remote callers use `pilot-server` API as control-plane entry, not direct bridge filesystem access.
- Strict TypeScript constraints apply to all new server code.
