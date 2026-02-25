# Module Status Matrix

This table is the source of truth for module lifecycle and documentation entrypoints.

Status definitions:

- `ACTIVE`: Current development path.
- `PLACEHOLDER`: Exists for future use or minimal scaffolding; do not expand by default.
- `HISTORICAL`: Archived path kept for traceability.
- `GENERATED`: Generated artifacts or SDK surfaces; avoid manual edits unless explicitly required.

| Path | Status | In Workspace | Canonical Doc | Notes |
| :--- | :--- | :--- | :--- | :--- |
| `apps/api` | `ACTIVE` | `pnpm` | [apps/api/README.md](../apps/api/README.md) | NestJS BFF service. |
| `apps/cli` | `ACTIVE` | `go.work` | [apps/cli/README.md](../apps/cli/README.md) | MCP tool server. |
| `apps/client` | `ACTIVE` | `pnpm` + `cargo` | [apps/client/README.md](../apps/client/README.md) | Desktop cockpit and Pilot runtime host surface. |
| `apps/dashboard` | `ACTIVE` | `pnpm` | [apps/dashboard/README.md](../apps/dashboard/README.md) | Admin web frontend. |
| `apps/pilot` | `ACTIVE` | `pnpm` (`bridge/server/host`) | [docs/design/pilot/README.md](../docs/design/pilot/README.md) | Suite root; use `apps/pilot/{bridge,host,server}` directly. |
| `apps/server-go` | `PLACEHOLDER` | `none` | [apps/server-go/README.md](../apps/server-go/README.md) | Reserved directory, no runtime code yet. |
| `apps/server-py` | `PLACEHOLDER` | `uv` | [apps/server-py/README.md](../apps/server-py/README.md) | Python placeholder service used for workspace bootstrap only. |
| `packages/client-daemon-go` | `GENERATED` | `go.work` | [packages/client-daemon-go/daemon/README.md](../packages/client-daemon-go/daemon/README.md) | Go SDK and generated API docs from daemon Swagger. |
| `packages/client-daemon-ts` | `ACTIVE` | `pnpm` | [packages/client-daemon-ts/README.md](../packages/client-daemon-ts/README.md) | TypeScript SDK consumed by `apps/client`. |
| `packages/computer-use` | `ACTIVE` | `go.work` | [packages/computer-use/README.md](../packages/computer-use/README.md) | Desktop automation plugin for daemon. |
| `packages/core-go` | `ACTIVE` | `go.work` | [packages/core-go/README.md](../packages/core-go/README.md) | Shared Go utilities used by daemon and CLI. |
| `packages/core-py` | `PLACEHOLDER` | `uv` | [packages/core-py/README.md](../packages/core-py/README.md) | Python shared package scaffold. |
| `packages/core-ts` | `ACTIVE` | `pnpm` | [packages/core-ts/README.md](../packages/core-ts/README.md) | Shared TypeScript logic and types. |
| `packages/daemon` | `ACTIVE` | `go.work` | [packages/daemon/README.md](../packages/daemon/README.md) | Sandbox daemon backend service. |
| `packages/hooks` | `PLACEHOLDER` | `none` | [packages/hooks/README.md](../packages/hooks/README.md) | Reserved for shared React hooks. |
| `packages/ui` | `PLACEHOLDER` | `none` | [packages/ui/README.md](../packages/ui/README.md) | Reserved for shared UI component library. |
