# Core Go (`packages/core-go`)

Shared Go utilities used by runtime modules (daemon, CLI, plugins).

## Purpose

- Provide reusable caching, logging, error, proxy, and utility helpers.
- Keep common Go logic out of `apps/cli` and `packages/daemon`.

## Entrypoints

- Module root: `go.mod`
- Shared packages: `pkg/*`

## Development

```bash
go test ./...
go fmt ./...
```

Or run workspace-wide checks:

```bash
make test-go
make fmt-go
```

## Notes for AI Agents

- Follow Go package boundaries; avoid app-specific logic in this module.
