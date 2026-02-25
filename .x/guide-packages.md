# Guide: Shared Packages

## Purpose

This guide maps shared package responsibilities and expected usage patterns.

## Boundaries

- Shared logic must live in `packages/*` when reused across applications.
- `apps/*` should remain entrypoint-focused and avoid duplicating reusable logic.

## Entrypoints

- TypeScript shared core: `packages/core-ts`
- TypeScript daemon SDK: `packages/client-daemon-ts`
- Go shared core: `packages/core-go`
- Daemon runtime package: `packages/daemon`
- Python shared core: `packages/core-py` (placeholder)
- Placeholder packages: `packages/hooks`, `packages/ui`

## Dev Commands

```bash
# Build TypeScript shared packages
pnpm --filter @cofy-x/deck-core-ts run build
pnpm --filter @cofy-x/client-daemon run build

# Build and test Go shared/runtime packages
make build-go
make test-go
```

## Config / Env

- Package workspace membership is defined by:
  - `pnpm-workspace.yaml`
  - `go.work`
  - `pyproject.toml` (`tool.uv.workspace`)

## Tests

- TypeScript packages: `pnpm --filter <pkg> run type-check` and `pnpm --filter <pkg> run lint`.
- Go packages: `go test ./...` (via `make test-go`).

## Read Next

- `.x/coding-standards.md`
- `.x/module-status.md`
- `packages/core-ts/README.md`
- `packages/core-go/README.md`
- `packages/client-daemon-ts/README.md`

## Common Pitfalls

- Do not import generated artifacts from `dist/` as sources for manual edits.
- Check `.x/module-status.md` before extending placeholder packages (`hooks`, `ui`, `core-py`).
