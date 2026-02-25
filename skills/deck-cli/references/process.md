# Process Commands

Use these commands for command execution and session lifecycle.

## TOC
- Quick rules
- `deck exec run`
- `deck session create`
- `deck session exec`
- `deck session list`
- `deck session delete`
- Common workflows

## Quick Rules

1. `deck exec run` is for one-off commands.
2. `deck session` commands are for persistent named shells.
3. Current CLI has no `session logs` and no `session exec --async`.
4. `exec run` and `session exec` print plain text output.

## deck exec run

```bash
deck exec run <command> [--cwd <path>] [--timeout <seconds>]
```

Examples:
```bash
deck exec run "npm test" --cwd /workspace/project
deck exec run "go test ./..." --cwd /workspace/project --timeout 120
deck exec run "pwd"
```

Behavior:
- Prints command result text directly.
- If command exits non-zero, CLI prints a warning line containing `Exit code: N`.

## deck session create

```bash
deck session create <id>
```

Examples:
```bash
deck session create dev-server
deck session create build-1
```

## deck session exec

```bash
deck session exec [id] <command>
```

Examples:
```bash
deck session exec dev-server "npm install"
deck session exec dev-server "npm run dev"
```

Behavior:
- Prints command output text.
- If `id` is omitted, CLI prompts for a session selection.

## deck session list

```bash
deck session list
```

Examples:
```bash
deck session list
deck session list | jq -r '.[].sessionId'
```

## deck session delete

```bash
deck session delete [id]
```

Examples:
```bash
deck session delete dev-server
deck session delete
```

Behavior:
- If `id` is omitted, CLI prompts for session selection.

## Common Workflows

### One-off test run

```bash
deck exec run "npm test" --cwd /workspace/project
```

### Session-based development

```bash
deck session create dev
deck session exec dev "npm install"
deck session exec dev "npm run dev"
deck session list
deck session delete dev
```

### Multiple sessions

```bash
deck session create api
deck session create web
deck session exec api "npm run dev:api"
deck session exec web "npm run dev:web"
deck session list
```
