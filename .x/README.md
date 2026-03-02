# .x/ — AI Agent Context Directory

This directory contains all context documents for AI coding agents working on the **deck** monorepo.

## Document Index

| Document | Purpose |
| :--- | :--- |
| [project-overview.md](./project-overview.md) | Monorepo structure, directory map, workspace managers, tech stack |
| [coding-standards.md](./coding-standards.md) | Coding rules, language conventions, naming patterns, git workflow |
| [guide-frontend.md](./guide-frontend.md) | Shared frontend conventions for TanStack-based React/TS apps (`client`, `dashboard`) |
| [guide-client.md](./guide-client.md) | `apps/client` — Tauri v2 desktop AI cockpit app |
| [guide-api.md](./guide-api.md) | `apps/api` — NestJS BFF service conventions and entrypoints |
| [guide-dashboard.md](./guide-dashboard.md) | `apps/dashboard` — React admin web app conventions and entrypoints |
| [guide-landing.md](./guide-landing.md) | `apps/landing` — React marketing website conventions and entrypoints |
| [guide-pilot.md](./guide-pilot.md) | `apps/pilot/*` — Pilot suite (host, server, bridge) |
| [guide-python.md](./guide-python.md) | `apps/server-py` and `packages/core-py` — Python workspace guide |
| [guide-runtime-go.md](./guide-runtime-go.md) | `apps/cli`, `packages/daemon`, `packages/computer-use` — Go runtime guide |
| [guide-packages.md](./guide-packages.md) | Shared package map (`core-*`, `client-daemon-*`, placeholders) |
| [module-status.md](./module-status.md) | Module lifecycle matrix for all `apps/*` and `packages/*` |

## Versioned Design Documents

| Directory | Purpose |
| :--- | :--- |
| [v0.1/](./v0.1/) | Historical v0.1 product and architecture snapshots |

## How to Use

1. **Start here** — read `project-overview.md` to understand the monorepo layout.
2. **Before coding** — read `coding-standards.md` for rules and conventions.
3. **Before frontend work in `client`/`dashboard`** — read `guide-frontend.md`.
4. **Before `apps/landing` work** — read `guide-landing.md`.
5. **For specific apps** — read the relevant `guide-*.md` file.
6. **For historical context** — read `v0.1/` snapshots only when older design intent is needed.

## Related Resources

- `docs/design/daemon.md` — Daemon PID 1 technical design (Go-based init process).
- `docs/design/client-chat-retry.md` — Client chat retry and attachment compatibility design.
- `docs/design/client-remote-opencode-web-auth.md` — Client remote OpenCode iframe auth bridge design.
- `docs/opencode/` — OpenCode API integration reference.
