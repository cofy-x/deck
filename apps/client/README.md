# Deck Client (`apps/client`)

Desktop cockpit built with Tauri v2 + React.  
It supports both:

- **Local sandbox mode** (Docker managed by Rust commands)
- **Remote sandbox mode** (connect to existing OpenCode/daemon/noVNC services)

## Features

- Split cockpit layout: Chat + Desktop/Viewer/Log
- OpenCode session management (SSE events, retry, permissions, questions)
- Remote OpenCode fullscreen support with Basic Auth via local bridge proxy
- Sandbox desktop view via noVNC
- Provider/model configuration
- Multi-profile connection management (local + multiple remotes)
- Session-only credential handling (not persisted)

## Run

```bash
cd apps/client
pnpm tauri dev
```

## Build

```bash
pnpm --filter @cofy-x/deck-app build
```

## Connection Profiles

Profiles are configured in **Settings -> Connections**.

### Local profile

- Built-in profile
- Uses localhost defaults:
  - OpenCode: `http://127.0.0.1:4096`
  - Daemon: `http://127.0.0.1:2280`
  - noVNC: `http://127.0.0.1:6080/vnc.html?autoconnect=true&resize=scale`
  - Web Terminal: `http://127.0.0.1:22222`

### Remote profile

Required:

- `OpenCode Base URL`

Optional overrides:

- `Daemon Base URL`
- `noVNC URL`
- `Web Terminal URL`

If overrides are empty, endpoints are derived from OpenCode host/protocol with default ports.

## Authentication

Credentials are entered per active profile and kept in memory only:

- OpenCode Basic Auth: username/password
- Daemon token header: `X-Deck-Token`

After app restart, credentials must be re-entered.

## OpenCode Web Bridge (Remote Basic Auth)

When the active profile is remote and OpenCode credentials are configured, fullscreen OpenCode
is loaded through a local Tauri bridge (`127.0.0.1`) instead of directly using the remote URL.

- The bridge injects `Authorization` and optional `x-opencode-directory` upstream headers.
- SSE and WebSocket traffic are forwarded through the same bridge.
- Bridge runtime is bound to the active profile and stopped on disconnect/profile switch.

## Mode Behavior

### Local mode

- Top action: `Start Sandbox` / `Stop Sandbox`
- Desktop boot auto-starts computer-use when needed
- Terminal panel available

### Remote mode

- Top action: `Connect Remote` / `Disconnect Remote`
- Desktop boot checks daemon and `computeruse/status`
- If computer-use is inactive, user must click **Start Desktop Services**
- OpenCode fullscreen uses the local bridge when remote Basic Auth is enabled
- Terminal panel is intentionally disabled in current release

## Important Paths

- Frontend entry: `src/main.tsx`
- Tauri backend: `src-tauri/src/lib.rs`
- Connection store: `src/stores/connection-store.ts`
- Sandbox lifecycle: `src/hooks/use-sandbox.ts`
- OpenCode web bridge hook: `src/hooks/use-opencode-web-bridge.ts`
- OpenCode web bridge invoke wrapper: `src/lib/opencode-web-bridge.ts`
- OpenCode bridge backend: `src-tauri/src/opencode_bridge/*`
- Pilot runtime backend: `src-tauri/src/pilot_runtime/*`
- OpenCode client factory: `src/lib/opencode.ts`
- Daemon client helpers: `src/lib/daemon.ts`
