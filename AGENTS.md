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
