# AI Agent Entry Point

This file guides AI coding agents to the project context documents.

## Getting Started

Read the documents in the `.x/` directory in the following order:

1. **[.x/README.md](.x/README.md)** — Document index and navigation guide.
2. **[.x/project-overview.md](.x/project-overview.md)** — Monorepo structure, directory map, workspace managers, build commands.
3. **[.x/coding-standards.md](.x/coding-standards.md)** — Coding rules, language conventions, git workflow.

## Before Working on Specific Areas

| Area | Read |
| :--- | :--- |
| Any React/TS frontend app | [.x/guide-frontend.md](.x/guide-frontend.md) |
| `apps/client` (Tauri desktop) | [.x/guide-client.md](.x/guide-client.md) |
| `apps/client` chat retry / attachment compatibility | [docs/design/client-chat-retry.md](docs/design/client-chat-retry.md) |
| `apps/client` remote OpenCode web auth bridge | [docs/design/client-remote-opencode-web-auth.md](docs/design/client-remote-opencode-web-auth.md) |
| `apps/api` (NestJS BFF) | [.x/guide-api.md](.x/guide-api.md) |
| `apps/dashboard` (React web admin) | [.x/guide-dashboard.md](.x/guide-dashboard.md) |
| `apps/pilot/*` (Pilot suite) | [.x/guide-pilot.md](.x/guide-pilot.md) |
| `apps/pilot/*` architecture and flows | [docs/design/pilot/README.md](docs/design/pilot/README.md), [docs/design/pilot/host.md](docs/design/pilot/host.md), [docs/design/pilot/bridge.md](docs/design/pilot/bridge.md), [docs/design/pilot/server.md](docs/design/pilot/server.md) |
| `apps/server-py` and `packages/core-py` | [.x/guide-python.md](.x/guide-python.md) |
| Shared packages (`packages/core-*`, `client-daemon-*`) | [.x/guide-packages.md](.x/guide-packages.md) |
| `apps/cli`, `packages/daemon`, `packages/computer-use` | [.x/guide-runtime-go.md](.x/guide-runtime-go.md), [apps/cli/README.md](apps/cli/README.md) |
| Daemon / sandbox containers | [docs/design/daemon.md](docs/design/daemon.md), [docker/desktop/sandbox-ai/README.md](docker/desktop/sandbox-ai/README.md), [docker/cli/README.md](docker/cli/README.md) |
| Module lifecycle / status map | [.x/module-status.md](.x/module-status.md) |
| v0.1 feature specs | [.x/v0.1/README.md](.x/v0.1/README.md) |

## Key Rules

- All code, comments, and variable names must be in **English**.
- Follow **Conventional Commits** for commit messages.
- Reusable logic must live in `packages/`, not duplicated across `apps/`.
- Verify paths against the actual directory structure before creating files.

## Cursor Cloud specific instructions

### Services overview

| Service | Command | Port | Notes |
|:---|:---|:---|:---|
| PostgreSQL + Redis | `docker compose -p deck -f deploy/local/docker-compose.yaml up -d` | 15432, 16379 | Must start Docker daemon first (`sudo dockerd &`) |
| NestJS API | `pnpm --filter @cofy-x/deck-api run dev` | 3001 | Needs DB+Redis; copy `.env.example` to `.env` and run `db:push` first |
| Dashboard | `pnpm --filter @cofy-x/deck-dashboard run dev` | 5173 | Vite dev server; depends on API for health checks |
| Landing | `pnpm --filter @cofy-x/deck-landing run dev` | 5180 | Standalone Vite dev server |

### Common commands

See `Makefile` and `.x/project-overview.md` for the full command reference. Key shortcuts:
- `make lint` (ESLint + golangci-lint), `make test` (Vitest + Go tests), `make build` (TS + Go).
- `pnpm run format` for Prettier formatting.

### Cloud VM caveats

- **Docker daemon**: Must be started manually (`sudo dockerd &>/tmp/dockerd.log &`) before running `docker compose`. After install, run `sudo chmod 666 /var/run/docker.sock` to avoid permission issues.
- **`packages/computer-use` Go tests**: Fail in headless environments because they require X11 libraries (`libxtst-dev`). This is expected; the package is designed to run inside desktop sandbox containers.
- **`apps/client` (Tauri)**: Cannot be built/run in cloud VMs without a full desktop environment and Tauri system dependencies (webkit2gtk, etc.). Test Tauri-related TS code via `pnpm --filter @cofy-x/deck-app run test`.
- **API startup sequence**: Before running the API (`pnpm --filter @cofy-x/deck-api run dev`), ensure: (1) Docker dev infra is up, (2) `.env` is copied from `.env.example`, (3) `pnpm --filter @cofy-x/deck-api run db:push` has been run.
- **pnpm build warnings**: Pilot bin symlink warnings (`Failed to create bin at ...`) are normal before building Pilot TypeScript. Run `pnpm run pilot:build` or `make pilot-build` to resolve.
