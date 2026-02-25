# Deck Daemon (`packages/daemon`)

Go runtime daemon for sandbox environments.

## Purpose

- Run as the sandbox process manager and expose toolbox APIs.
- Coordinate PTY, process, filesystem, git, and computer-use capabilities.

## Entrypoints

- Main binary: `cmd/daemon/main.go`
- Core runtime packages: `pkg/*`
- Shared helpers: `internal/*`

## Development

```bash
# Build daemon for host/default target
make build-daemon

# Build Linux target used in sandbox images
make build-daemon-linux

# Run tests
go test ./...
```

## Design Reference

- `docs/design/daemon.md`

## Notes for AI Agents

- Keep shared reusable Go utilities in `packages/core-go`.
- Treat generated Swagger and SDK outputs as derived artifacts.
