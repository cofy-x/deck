# Deck Client Remote OpenCode Web Auth Bridge

## Context

Remote OpenCode API calls already support Basic Auth through the SDK fetch layer.
However, OpenCode fullscreen is rendered inside an iframe, and iframe navigations cannot attach
custom auth headers from frontend code. A direct iframe to remote OpenCode returns `401` when
Basic Auth is required.

## Current Status

Implemented.

Remote OpenCode fullscreen now uses a local Tauri bridge when:

- active profile type is `remote`
- OpenCode username/password are configured
- sandbox state is `running`

Otherwise, the iframe continues to use the direct OpenCode URL.

## Runtime Architecture

### Frontend

- `src/hooks/use-opencode-web-bridge.ts`
  - decides whether bridge is required
  - starts/stops bridge via Tauri invoke commands
  - listens for bridge auth-failure events and maps them to client unauthorized state
- `src/components/viewer/right-panel.tsx`
  - consumes bridge state and renders loading/error states
  - uses bridge iframe URL/key when bridge is active

### Tauri Backend

- `src-tauri/src/opencode_bridge/mod.rs`
  - lifecycle orchestration (start/stop/idempotency/profile scoping)
- `src-tauri/src/opencode_bridge/proxy.rs`
  - HTTP proxy, SSE streaming, and WebSocket upgrade forwarding
- `src-tauri/src/opencode_bridge/routing.rs`
  - iframe path mapping and upstream URL construction
  - corrupted `directory` query sanitization for session routes
- `src-tauri/src/opencode_bridge/http_io.rs`
  - HTTP parsing, header filtering/injection, response streaming
- `src-tauri/src/opencode_bridge/lifecycle.rs`
  - input validation, auth header construction, stable preferred port selection

## Directory Handling

- Bridge does not force a fallback `"/"` directory when no directory is provided.
- If project directory is available, bridge injects `x-opencode-directory`.
- For `/session*` requests, corrupted or non-absolute `directory` query values are repaired
  with forced directory when available, or dropped when unavailable.
- Client lifecycle sync (`use-sandbox.ts`) initializes project directory from `/path.directory`
  before transitioning remote sandbox state to `running`, reducing first-connect race conditions.

## Security Properties

- Bridge binds to localhost only.
- Credentials are memory-only and not persisted.
- Credentials are not placed in iframe URL query params.
- Bridge runtime is scoped to the active profile and is stopped on disconnect/profile switch.

## Observability

Bridge emits and logs:

- `deck://opencode-bridge-started`
- `deck://opencode-bridge-upstream-failure`
- `deck://opencode-bridge-auth-failure`
- request logs for key routes (`/opencode`, `/path`, `/project/current`, `/session*`)

## Current Limitation

WebSocket upgrades to `https` upstream are not yet supported by the bridge tunnel and return `501`.

## Validation Coverage

- Rust tests:
  - routing behavior (path mapping, encoding, query sanitization)
  - lifecycle preferred port stability
- Docker name matching tests:
  - exact container-name matching for local status detection
- Frontend build checks:
  - TypeScript + Vite build for bridge integration
