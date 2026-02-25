# Deck CLI Command Matrix

Source of truth date: 2026-02-15

This matrix maps current CLI commands to expected syntax and output shape.

## Process

| Command | Syntax | Output |
|---|---|---|
| `exec run` | `deck exec run <command> [--cwd <path>] [--timeout <seconds>]` | Plain text command result. Non-zero command exits are shown as warning line (`Exit code: N`). |
| `session create` | `deck session create <id>` | Success line plus optional JSON payload. |
| `session exec` | `deck session exec [id] <command>` | Plain text command output. |
| `session list` | `deck session list` | JSON array of sessions (`sessionId`, `commands`). |
| `session delete` | `deck session delete [id]` | Success line plus optional JSON payload. |

Unsupported in current CLI:
- `deck session logs`
- `deck session exec --async`

## Filesystem

| Command | Syntax | Output |
|---|---|---|
| `fs ls` | `deck fs ls [path]` | JSON array of file info entries. |
| `fs info` | `deck fs info <path>` | JSON object with fields like `name`, `isDir`, `size`, `mode`, `permissions`. |
| `fs cat` | `deck fs cat <path>` | Raw file content (plain text). |
| `fs write` | `deck fs write <path> <content>` | Success line plus JSON result. |
| `fs mkdir` | `deck fs mkdir <path>` | Success line plus JSON result. |
| `fs rm` | `deck fs rm <path> [--recursive] [--force]` | Success/info line plus JSON when available. |
| `fs mv` | `deck fs mv <source> <destination>` | Success line plus JSON result. |
| `fs search` | `deck fs search <path> <pattern>` | JSON object: `{"files": ["..."]}`. |
| `fs grep` | `deck fs grep <path> <pattern>` | JSON array of matches (`file`, `line`, `content`). |
| `fs replace` | `deck fs replace <pattern> <replacement> <files...>` | Success line plus JSON array of replace results (`file`, `success`, `error`). |

## Git

| Command | Syntax | Output |
|---|---|---|
| `git clone` | `deck git clone <url> <path>` | Success line plus JSON payload. |
| `git status` | `deck git status [path]` | JSON object with `currentBranch`, `fileStatus[]`, optional `ahead/behind/branchPublished`. |
| `git add` | `deck git add <path> <files...>` | Success line plus JSON payload. |
| `git commit` | `deck git commit <path> --message <msg> --author <name> --email <email>` | Success line plus JSON payload including `hash`. |
| `git branches` | `deck git branches [path]` | JSON list-branch response. |
| `git branch` | `deck git branch <path> <name>` | Success line plus JSON payload. |
| `git checkout` | `deck git checkout <path> <branch>` | Success line plus JSON payload. |
| `git pull` | `deck git pull <path>` | Success line plus JSON payload. |
| `git push` | `deck git push <path>` | Success line plus JSON payload. |

Do not parse these legacy fields from `git status`:
- `.branch`
- `.staged`
- `.modified`
- `.untracked`

Use `fileStatus[]` instead.

## Computer

| Command | Syntax | Output |
|---|---|---|
| `screenshot` | `deck computer screenshot [...]` | JSON object with base64 in `screenshot` field. |
| `mouse click` | `deck computer mouse click <x> <y> [--button ...]` | JSON response from daemon. |
| `mouse move` | `deck computer mouse move <x> <y>` | JSON response from daemon. |
| `mouse drag` | `deck computer mouse drag <x1> <y1> <x2> <y2>` | JSON response from daemon. |
| `mouse scroll` | `deck computer mouse scroll <x> <y> <up\|down>` | JSON response from daemon. |
| `keyboard type` | `deck computer keyboard type <text>` | JSON response from daemon. |
| `keyboard press` | `deck computer keyboard press <key>` | JSON response from daemon. |
| `keyboard hotkey` | `deck computer keyboard hotkey <keys...>` | JSON response from daemon. |
| `browser` | `deck computer browser <url> [--incognito]` | JSON response from daemon. |
| `display-info` | `deck computer display-info` | JSON array of displays. |
| `windows` | `deck computer windows` | JSON array of windows. |

Unsupported CLI options in current release:
- `mouse click --double`
- `mouse scroll --amount`
- `keyboard type --delay`
- `keyboard press --modifiers`

## System and Config

| Command | Syntax | Output |
|---|---|---|
| `info version` | `deck info version` | JSON version object. |
| `info workdir` | `deck info workdir` | JSON: `{"workdir":"..."}` |
| `info homedir` | `deck info homedir` | JSON: `{"homedir":"..."}` |
| `info ports` | `deck info ports` | JSON: `{"ports":[...]}` |
| `config get` | `deck config get <key>` | Plain text value. |
| `config set` | `deck config set <key> <value>` | Success line. |

Valid config keys:
- `daemon-url`
- `output-format`
- `no-color`

## MCP Mapping Notes

When working through MCP (`deck mcp serve`), tool names differ from CLI subcommands.
Use MCP tool docs only in MCP contexts. For direct shell usage, always follow CLI syntax above.
