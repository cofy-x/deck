# Guide: Go Runtime (`apps/cli`, `packages/daemon`, `packages/computer-use`)

## Purpose

This guide covers the Go runtime stack that powers sandbox execution and MCP tooling.

## Boundaries

- `apps/cli`: MCP tool server binary (`deck`).
- `packages/daemon`: sandbox daemon backend service.
- `packages/computer-use`: desktop automation plugin used by daemon.

## Entrypoints

- CLI entry: `apps/cli/cmd/cli/main.go`
- Daemon entry: `packages/daemon/cmd/daemon/main.go`
- Computer-use plugin entry: `packages/computer-use`
- Workspace manifest: `go.work`

## Dev Commands

```bash
# Download Go dependencies for all modules
make install-go

# Build runtime binaries
make build-go
make build-cli
make build-daemon

# Test runtime modules
make test-go
```

## Config / Env

- `DECK_DAEMON_URL` configures CLI target daemon URL.
- Build defaults use `CGO_ENABLED=0`.
- Cross-platform build targets are available in `Makefile`.

## Tests

- Run `make test-go` for all modules in `go.work`.
- Run module-local tests when changing package internals (`go test ./...`).

## Read Next

- `apps/cli/README.md`
- `docs/design/daemon.md`
- `packages/computer-use/README.md`

## Common Pitfalls

- Keep shared Go utilities in `packages/core-go`, not duplicated in `apps/cli` or `packages/daemon`.
- Avoid manual edits in generated SDK directories under `packages/client-daemon-go/daemon/docs`.
