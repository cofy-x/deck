# Deck CLI AI Sandbox

## Deck CLI Image Architecture

The Deck CLI environment is engineered for high-speed terminal automation and developer productivity. It utilizes a **three-tier layering strategy** to optimize build performance and ensure environment parity across different sandbox instances.

1. **`cli-runtime-base` (L1)**: The core environment. It contains the OS foundation, mirror optimizations, and the primary developer toolchain including **Go 1.25.6**, **Node.js v24.13.0** (managed via NVM), **Python 3.10**, and **Poetry**. It also initializes the customized **Zsh** environment with **Oh-My-Zsh** for enhanced human-agent interaction.
2. **`cli-runtime-ai` (L2)**: The AI dependency layer. This tier isolates the installation of heavy CLI tools like **Claude Code**, **Gemini CLI**, **OpenCode AI**, and **Codex**. By "freezing" these tools in a dedicated layer, the sandbox avoids redundant network-intensive installations during daemon updates.
3. **`cli-sandbox-ai` (L3)**: The final application layer. This lightweight layer injects the **`deck-daemon`** and **`deck` CLI** binaries, plus the built-in OpenCode skill `deck-cli`. It is designed for near-instant builds (sub-second) when iterating on the daemon’s Go source code.

---

## Technical Core: The Deck Daemon (PID 1)

Even in a pure CLI environment, the `deck-daemon` acts as the container's **Init process (PID 1)**, fulfilling critical system-level duties that ensure long-term sandbox stability.

### 1. Advanced Process Management

- **Zombie Reaping**: CLI-based AI tools often spawn multiple sub-processes (git, compilers, linters). The daemon actively reaps these orphaned processes using `SIGCHLD` monitoring to prevent PID exhaustion.
- **Signal Propagation**: It ensures that signals like `SIGTERM` are correctly forwarded to the process group, allowing for a graceful shutdown of all active terminal sessions and background tasks.

### 2. Managed Terminal Environment

- **PTY Orchestration**: The daemon provides the infrastructure for managed PTY (Pseudo-Terminal) allocation, allowing remote AI agents to interact with a fully-featured Zsh shell.
- **Path & Environment Integrity**: The daemon ensures that all tools (Node, Go, Pipx) are available in the `PATH` regardless of how the session is initiated (SSH, WebSocket, or API).

## Built-in Skill (`deck-cli`) + Deck CLI

The `deck` binary (installed at `/usr/local/bin/deck`) remains available in the sandbox and can still be used for direct CLI workflows against the daemon API on `localhost:2280`.

This image now ships a built-in global OpenCode skill at:

- `/home/deck/.config/opencode/skills/deck-cli`

OpenCode is configured in skills-first mode:

```json
{
  "skills": {
    "paths": ["/home/deck/.config/opencode/skills"]
  }
}
```

Compatibility note:

- `deck mcp serve` is still available in the `deck` binary.
- `cli-sandbox-ai` no longer injects `mcp.deck-mcp` by default.

---

## Pre-Installed Toolchain

| Category             | Tool        | Version / Details           |
| -------------------- | ----------- | --------------------------- |
| **Languages**        | Node.js     | v24.13.0 (via NVM)          |
|                      | Go          | 1.25.6                      |
|                      | Python      | 3.10.x                      |
| **Package Managers** | PNPM / NPM  | Latest / pnpm-ready         |
|                      | Poetry      | Latest (via Pipx)           |
| **AI CLI Tools**     | Claude Code | Latest (via Claude.ai)      |
|                      | Gemini CLI  | 0.26.0                      |
|                      | OpenCode AI | 1.1.43                      |
| **Shell**            | Zsh         | Oh-My-Zsh + Autosuggestions |

## Build & Development

The CLI product line is physically isolated from the Desktop line in `docker/cli/`. This allows for independent versioning and smaller image footprints (no X11/Chrome overhead).

### Build Sequence

To build the full CLI stack, follow the tier order:

```sh
# Build L1
docker build -t deck/cli-runtime-base:latest ./docker/cli/runtime-base

# Build L2
docker build -t deck/cli-runtime-ai:latest ./docker/cli/runtime-ai

# Build L3 (Rapid Iteration)
docker build -t deck/cli-sandbox-ai:latest ./docker/cli/sandbox-ai
```

### Environment Testing

The `runtime-base` includes a built-in "smoke test" during the build process:

```dockerfile
RUN node --version && go version && python3 --version && poetry --version
```

This ensures that any breaking change in the environment is caught immediately at the base layer.

---

## Industrial Dev-Station Ready

The final sandbox provides a professional greeting and diagnostic MOTD upon entry, ensuring that both human operators and AI agents have immediate visibility into the station's health and tool versions.
