# Pilot Server

Filesystem-backed API for Pilot remote clients. This package provides the Pilot server layer and is intentionally independent from the desktop app.

## Quick start

```bash
npm install -g pilot-server
pilot-server --workspace /path/to/workspace --approval auto
```

`pilot-server` ships as a compiled binary, so Bun is not required at runtime.

Or from source:

```bash
pnpm --filter pilot-server dev -- \
  --workspace /path/to/workspace \
  --approval auto
```

The server logs the client token and host token on boot when they are auto-generated.

Add `--verbose` to print resolved config details on startup. Use `--version` to print the server version and exit.

## Config file

Defaults to `~/.config/pilot/server.json` (override with `PILOT_SERVER_CONFIG` or `--config`).

```json
{
  "host": "127.0.0.1",
  "port": 8787,
  "approval": { "mode": "manual", "timeoutMs": 30000 },
  "workspaces": [
    {
      "id": "finance-local",
      "path": "/Users/susan/Finance",
      "name": "Finance",
      "workspaceType": "local",
      "baseUrl": "http://127.0.0.1:4096",
      "directory": "/Users/susan/Finance"
    }
  ],
  "corsOrigins": ["http://localhost:5173"]
}
```

## Environment variables

- `PILOT_SERVER_CONFIG` path to config JSON
- `PILOT_HOST` / `PILOT_PORT`
- `PILOT_TOKEN` client bearer token
- `PILOT_HOST_TOKEN` host approval token
- `PILOT_APPROVAL_MODE` (`manual` | `auto`)
- `PILOT_APPROVAL_TIMEOUT_MS`
- `PILOT_WORKSPACES` (JSON array or comma-separated list of paths)
- `PILOT_WORKSPACE` single-workspace fallback when `PILOT_WORKSPACES` is unset
- `PILOT_CORS_ORIGINS` (comma-separated list or `*`)
- `PILOT_OPENCODE_URL`
- `PILOT_OPENCODE_DIRECTORY`
- `PILOT_OPENCODE_USERNAME`
- `PILOT_OPENCODE_PASSWORD`
- `PILOT_MAX_BODY_BYTES` max request body size in bytes (default `1048576`)

## Endpoints (initial)

- `GET /health`
- `GET /status`
- `GET /capabilities`
- `GET /workspaces`
- `GET /scheduler/jobs`
- `DELETE /scheduler/jobs/:slug`
- `GET /w/:id/health`
- `GET /w/:id/status`
- `GET /w/:id/capabilities`
- `GET /w/:id/workspaces`
- `GET /workspace/:id/config`
- `PATCH /workspace/:id/config`
- `GET /workspace/:id/events`
- `POST /workspace/:id/engine/reload`
- `GET /workspace/:id/plugins`
- `POST /workspace/:id/plugins`
- `DELETE /workspace/:id/plugins/:name`
- `GET /workspace/:id/skills`
- `POST /workspace/:id/skills`
- `GET /workspace/:id/mcp`
- `POST /workspace/:id/mcp`
- `DELETE /workspace/:id/mcp/:name`
- `GET /workspace/:id/commands`
- `POST /workspace/:id/commands`
- `DELETE /workspace/:id/commands/:name`
- `GET /workspace/:id/audit`
- `GET /workspace/:id/export`
- `POST /workspace/:id/import`
- `POST /workspace/:id/bridge/telegram-token`
- `POST /workspace/:id/bridge/slack-tokens`

## Workspace model

- Workspace model is `single-active`.
- `GET /workspaces` returns all authorized workspaces, with active workspace first.
- Workspace payloads include `opencode.baseUrl`, `opencode.directory`, `opencode.username`, and `opencode.password` when configured.
- `workspaces[].id` is optional; if omitted, server derives a stable id from workspace settings.
- `workspaceType: "remote"` requires `baseUrl` and `directory`.
- Workspace ids must be unique; duplicate ids fail startup with `422 duplicate_workspace_id`.

## Approvals

All writes are gated by host approval. Host APIs require `X-Pilot-Host-Token`:

- `GET /approvals`
- `POST /approvals/:id` with `{ "reply": "allow" | "deny" }`

Set `PILOT_APPROVAL_MODE=auto` to auto-approve during local development.

## Validation and errors

- Request bodies are validated with runtime schemas. Invalid JSON returns `400 invalid_json`; schema mismatch returns `422 invalid_payload`.
- Requests above `PILOT_MAX_BODY_BYTES` return `413 payload_too_large`.
- Invalid route parameter encoding returns `400 invalid_route_param`.
- If mutate succeeds but audit/reload fails, write routes return `500 write_partially_applied` with `details.mutated=true`.
