---
name: deck-cli
description: |
  Direct deck CLI workflows for sandbox operations: process execution, filesystem,
  git, computer control, and system inspection.

  Use this skill when working with the `deck` command line interface (not MCP tool names)
  and you need accurate command syntax, output parsing behavior, and safe shell helpers.
---

# Deck CLI Skill

Compatibility Matrix Updated: 2026-02-15

Supported Surface:
- CLI command tree under `apps/cli/internal/cmd/*`
- Daemon response models under `packages/client-daemon-go/daemon/model_*.go`

## Core Rules

1. Treat this skill as **CLI-first** documentation.
2. Use real CLI command syntax (grouped commands), not MCP tool names.
3. Assume some commands print plain text even when `--format json` is set.
4. Parse output by actual behavior, not guessed fields.

## Mode Selection

Use CLI command mode when you run shell commands directly:
- `deck fs ...`
- `deck git ...`
- `deck exec run ...`
- `deck computer ...`

Use MCP tool mode only when integrating through `deck mcp serve`.
If you need MCP tool names and arguments, see `references/command-matrix.md`.

## Quick Start

```bash
# Check daemon and environment
deck info version
deck info workdir
deck info homedir
deck info ports

# Common file operations
deck fs ls .
deck fs info ./README.md
deck fs cat ./README.md

# Command execution (plain text output)
deck exec run "pwd"

# Git status (structured JSON)
deck git status .
```

## High-Frequency Commands

### Process
- `deck exec run <command> [--cwd <path>] [--timeout <seconds>]`
- `deck session create <id>`
- `deck session exec [id] <command>`
- `deck session list`
- `deck session delete [id]`

Important:
- No session log retrieval subcommand in current CLI.
- No `--async` flag on `deck session exec` in current CLI.
- `deck exec run` and `deck session exec` print plain text output.

### Filesystem
- `deck fs ls [path]`
- `deck fs info <path>`
- `deck fs cat <path>`
- `deck fs write <path> <content>`
- `deck fs mkdir <path>`
- `deck fs rm <path> [--recursive] [--force]`
- `deck fs mv <source> <destination>`
- `deck fs search <path> <pattern>`
- `deck fs grep <path> <pattern>`
- `deck fs replace <pattern> <replacement> <files...>`

Important:
- `deck fs cat` returns raw file content, not JSON.
- `deck fs write` requires `<content>` argument; stdin piping is not supported by this CLI command.

### Git
- `deck git clone <url> <path>`
- `deck git status [path]`
- `deck git add <path> <files...>`
- `deck git commit <path> --message <msg> --author <name> --email <email>`
- `deck git branches [path]`
- `deck git branch <path> <name>`
- `deck git checkout <path> <branch>`
- `deck git pull <path>`
- `deck git push <path>`

Important:
- `git status` uses `currentBranch` and `fileStatus[]`, not `branch/staged/modified/untracked`.

### Computer
- `deck computer screenshot [--format png|jpeg] [--quality 1-100] [--scale 0.1-1.0] [--show-cursor] [-o <file>]`
- `deck computer mouse click <x> <y> [--button left|right|middle]`
- `deck computer mouse move <x> <y>`
- `deck computer mouse drag <x1> <y1> <x2> <y2>`
- `deck computer mouse scroll <x> <y> <up|down>`
- `deck computer keyboard type <text>`
- `deck computer keyboard press <key>`
- `deck computer keyboard hotkey <keys...>`
- `deck computer browser <url> [--incognito]`
- `deck computer display-info`
- `deck computer windows`

Important:
- Screenshot base64 field is `screenshot`, not `image`.
- No `--double` on CLI mouse click.
- No `--amount` on CLI mouse scroll.
- No `--delay` for CLI keyboard type.
- No `--modifiers` for CLI keyboard press.

### System / Config
- `deck info version`
- `deck info workdir` -> `{"workdir":"..."}`
- `deck info homedir` -> `{"homedir":"..."}`
- `deck info ports` -> `{"ports":[...]}`
- `deck config get <key>` where key is one of `daemon-url`, `output-format`, `no-color`
- `deck config set <key> <value>`

## Helper Scripts (in this skill)

Implemented and maintained:
- `scripts/health-check.sh`
- `scripts/diagnose.sh`
- `scripts/init-project.sh`
- `scripts/run-tests.sh`
- `scripts/git-safe-commit.sh`
- `scripts/batch-replace.sh`
- `scripts/code-search.sh`
- `scripts/backup-files.sh`

Validation:
- `scripts/validate-deck-cli-skill.sh`

## References

- Command source of truth: `references/command-matrix.md`
- Process workflows: `references/process.md`
- Filesystem workflows: `references/filesystem.md`
- Git workflows: `references/git.md`
- Computer workflows: `references/computer-use.md`
- System/config workflows: `references/system.md`

## Safety Guidance

1. Run `deck git status` before git mutations.
2. Use `scripts/backup-files.sh` before large replace operations.
3. Use `scripts/batch-replace.sh --preview` before applying replacements.
4. Prefer `deck fs grep` to inspect scope before `deck fs replace`.
