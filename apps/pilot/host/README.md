# Pilot Host

Headless host orchestrator for OpenCode + Pilot server + Bridge. This is a CLI-first way to run host mode without the desktop UI.

## Quick start

```bash
npm install -g @cofy-x/deck-pilot-host
pilot-host start --workspace /path/to/workspace --approval auto
```

`pilot-host start` and `pilot-host serve` both run in log-stream mode.

```bash
pilot-host serve --workspace /path/to/workspace
```

`pilot-host` ships as a compiled binary, so Bun is not required at runtime.

If OpenCode is already running, host can connect to it directly and only orchestrate
Pilot server + Bridge (external OpenCode mode).

`pilot-host` downloads and caches `pilot-server` and `bridge` sidecars using the remote
SHA-256 manifest. Use `--sidecar-dir` or `PILOT_SIDECAR_DIR` to control the cache location,
and `--sidecar-base-url` / `--sidecar-manifest` to point at a custom host.

`opencode` uses a separate resolution path: bundled binary first, then sidecar/opencode
download fallback when needed.

Use `--sidecar-source` to control where `pilot-server` and `bridge` are resolved
(`auto` | `bundled` | `downloaded` | `external`), and `--opencode-source` to control
`opencode` resolution. Set `PILOT_SIDECAR_SOURCE` / `PILOT_OPENCODE_SOURCE` to
apply the same policies via env vars.

By default the manifest is fetched from
`https://github.com/cofy-x/deck/releases/download/pilot-host-v<pilot-host-version>/pilot-host-sidecars.json`,
with automatic fallback to legacy `pilot-v.../pilot-sidecars.json` naming.

Bridge is optional. If it exits, `pilot-host` continues running unless you pass
`--bridge-required` or set `PILOT_BRIDGE_REQUIRED=1`.

In monorepo development, `auto` mode already prefers workspace binaries from
`node_modules/.bin` when available. `PILOT_ALLOW_EXTERNAL=1` / `--allow-external` is required
when you explicitly pass external binary paths (`--pilot-server-bin`, `--bridge-bin`,
`--opencode-bin`) or need PATH fallback.

Add `--verbose` (or `PILOT_VERBOSE=1`) to print extra diagnostics about resolved binaries.

Or from source:

```bash
pnpm --filter @cofy-x/deck-pilot-host run dev -- \
  start --workspace /path/to/workspace --approval auto
```

The command prints pairing details (Pilot server URL + token, OpenCode URL + auth) so remote Pilot clients can connect.

Use `--detach` to keep services running and exit the command. The detach summary includes the
Pilot server URL, tokens, and the `opencode attach` command.

## External services mode

Use external URLs when services are managed outside host:

- `--opencode-url` (or `PILOT_OPENCODE_URL`)
- `--pilot-url` (or `PILOT_URL`)
- `--bridge-url` (or `PILOT_BRIDGE_URL`)

```bash
pilot-host start \
  --workspace /path/to/workspace \
  --opencode-url http://127.0.0.1:4096 \
  --pilot-url http://127.0.0.1:8787 \
  --bridge-url http://127.0.0.1:3005 \
  --pilot-token <client-token> \
  --pilot-host-token <host-token> \
  --approval auto
```

Mixed mode is supported (for example, external OpenCode + host-managed pilot-server/bridge):

```bash
PILOT_OPENCODE_URL=http://127.0.0.1:4096 \
pilot-host start --workspace /path/to/workspace --approval auto
```

When an external URL is set, host will not spawn that service.

Conflict rules:

- `--opencode-url` cannot be combined with `--opencode-host` or `--opencode-port`.
- `--pilot-url` cannot be combined with `--pilot-host`, `--pilot-port`, or `--pilot-server-bin`.
- `--bridge-url` cannot be combined with `--bridge-bin`, `--bridge-health-port`, or `--no-bridge`.

External `--pilot-url` requires both `--pilot-token` and `--pilot-host-token` (or `PILOT_TOKEN` and `PILOT_HOST_TOKEN`) so host can perform strict startup verification.

If all enabled services are external, `pilot-host start|serve` verifies health, prints payload, and exits `0` by default. Use `--check` for extra smoke checks, or `pilot-host status` for periodic checks.

## Logging

`pilot-host` emits a unified log stream from OpenCode, Pilot server, and Bridge. Use JSON format for
structured, OpenTelemetry-friendly logs and a stable run id for correlation.

```bash
PILOT_LOG_FORMAT=json pilot-host start --workspace /path/to/workspace
```

Use `--run-id` or `PILOT_RUN_ID` to supply your own correlation id.
When `--json` is set, output is a single JSON document only (no mixed log lines).

Pilot server logs every request with method, path, status, and duration. Disable this when running
`pilot-server` directly by setting `PILOT_LOG_REQUESTS=0` or passing `--no-log-requests`.

## Router daemon (multi-workspace)

The router keeps a single OpenCode process alive and switches workspaces JIT using the `directory` parameter.
For safety, keep `pilot-host daemon` bound to loopback (`127.0.0.1`) unless you explicitly need remote access and protect the network path yourself.

```bash
pilot-host daemon start
pilot-host workspace add /path/to/workspace-a
pilot-host workspace add /path/to/workspace-b
pilot-host workspace list --json
pilot-host workspace path <id>
pilot-host instance dispose <id>
```

Use `PILOT_DATA_DIR` or `--data-dir` to isolate router state in tests.

## Pairing notes

- Use the **Pilot server connect URL** and **client token** to connect a remote Pilot client.
- The Pilot server advertises the **OpenCode connect URL** plus optional basic auth credentials to the client.

## Approvals (manual mode)

```bash
pilot-host approvals list \
  --pilot-url http://<host>:8787 \
  --host-token <token>

pilot-host approvals reply <id> --allow \
  --pilot-url http://<host>:8787 \
  --host-token <token>
```

## Health checks

```bash
pilot-host status \
  --pilot-url http://<host>:8787 \
  --opencode-url http://<host>:4096 \
  --bridge-url http://127.0.0.1:3005
```

Set `PILOT_BRIDGE_URL` to include bridge health in `pilot-host status` without passing
`--bridge-url` every time.
If both are omitted, `pilot-host status` checks bridge at `http://127.0.0.1:${BRIDGE_HEALTH_PORT:-3005}`.
`pilot-host status` exits with non-zero status when any checked service is unhealthy.
Text output is grouped by service, lists bridge channels as enabled/disabled sets, and ends with a health summary line.

## Smoke checks

```bash
pilot-host start --workspace /path/to/workspace --check --check-events
```

This starts the services, verifies health + SSE events, then exits cleanly.

## Local development

Point to source CLIs for fast iteration:

```bash
pilot-host start \
  --workspace /path/to/workspace \
  --allow-external \
  --pilot-server-bin ../server/src/cli.ts \
  --bridge-bin ../bridge/dist/cli.js
```
