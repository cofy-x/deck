# Deck CLI

Go CLI providing an MCP (Model Context Protocol) tool server that exposes sandbox daemon capabilities to AI agents.

## Overview

The CLI binary (`deck`) runs as an MCP server over stdio, translating MCP tool calls into daemon REST API requests. It is designed to be embedded inside sandbox containers and consumed by AI coding agents (OpenCode, Claude Code, etc.) as their tool backend.

```
AI Agent (OpenCode) --stdio/JSON-RPC--> deck mcp serve --HTTP--> Daemon API (:2280)
```

## Usage

```bash
# Start MCP server (default daemon URL: http://localhost:2280)
deck mcp serve

# Start with custom daemon URL
deck mcp serve --daemon-url http://localhost:12280

# Or via environment variable
DECK_DAEMON_URL=http://localhost:12280 deck mcp serve

# Initialize MCP config for a specific agent
deck mcp init claude
deck mcp init cursor
deck mcp init windsurf

# Print MCP JSON config snippet
deck mcp config

# Print version
deck version
```

## Runtime Options

```bash
# Enable verbose logs
deck --verbose mcp serve

# Set log level via environment variable (trace, debug, info, warn, error)
DECK_LOG_LEVEL=debug deck mcp serve

# Output format for non-MCP commands (json, text)
deck --format text info version
```

## MCP Tools (40 total)

<!-- prettier-ignore -->
| Category | Tools | Count |
|:---|:---|:---|
| **Process** | `execute_command`, `create_session`, `session_execute`, `get_session_command_logs`, `list_sessions`, `delete_session` | 6 |
| **File System** | `list_files`, `file_info`, `create_folder`, `download_file`, `upload_file`, `delete_file`, `move_file`, `search_files`, `find_in_files`, `replace_in_files` | 10 |
| **Git** | `git_clone`, `git_status`, `git_add`, `git_commit`, `git_branches`, `git_checkout`, `git_create_branch`, `git_pull`, `git_push` | 9 |
| **Computer Use** | `screenshot`, `mouse_click`, `mouse_move`, `mouse_drag`, `mouse_scroll`, `keyboard_type`, `keyboard_press`, `keyboard_hotkey`, `open_browser`, `get_display_info`, `get_windows` | 11 |
| **System** | `get_version`, `get_work_dir`, `get_home_dir`, `get_ports` | 4 |

## Agent Configuration

> Note: In `docker/desktop/sandbox-ai` and `docker/cli/sandbox-ai`, the default OpenCode setup is now skills-first (`skills.paths`) and does not inject `mcp.deck-mcp` by default. The MCP configuration below is for manual/explicit MCP enablement.

### OpenCode

```json
// ~/.config/opencode/opencode.json
{
  "$schema": "https://opencode.ai/config.json",
  "mcp": {
    "deck-mcp": {
      "type": "local",
      "command": ["/usr/local/bin/deck", "mcp", "serve"]
    }
  }
}
```

### Claude Desktop / Cursor / Windsurf

Use the built-in init command:

```bash
deck mcp init claude    # writes to Claude Desktop config
deck mcp init cursor    # writes to Cursor mcp.json
deck mcp init windsurf  # writes to Windsurf mcp_config.json
```

## Project Structure

```
apps/cli/
├── cmd/cli/main.go              # Cobra entry point
├── internal/
│   ├── buildinfo.go             # Version injection via ldflags
│   ├── cmd/
│   │   ├── mcp/
│   │   │   ├── mcp.go           # `mcp` command group
│   │   │   ├── start.go         # `mcp serve` — stdio MCP server
│   │   │   ├── init.go          # `mcp init` — agent config injection
│   │   │   ├── config.go        # `mcp config` — print JSON config
│   │   │   └── agents/          # Per-agent config path resolvers
│   │   └── version.go           # `version` command
│   └── mcp/
│       ├── server.go            # MCP server setup + tool registration
│       └── tools/
│           ├── common.go        # Shared helpers (JSON, errors, temp files)
│           ├── process.go       # Process/session execution tools
│           ├── filesystem.go    # File system tools
│           ├── git.go           # Git tools
│           ├── computer_use.go  # Mouse, keyboard, screenshot, browser tools
│           └── system.go        # Version, work dir, ports tools
```

## Build

```bash
# Build for current platform
make build-cli

# Build for Linux/AMD64 (for Docker containers)
make build-cli-linux

# Build for macOS ARM64
make build-cli-darwin-arm64

# Build + test with MCP Inspector
make dev-cli-mcp
```
