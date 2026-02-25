# Filesystem Commands

Use these commands for file navigation, read/write, search, and replacement.

## TOC
- Quick rules
- Core commands
- Search and replace
- Common workflows

## Quick Rules

1. `deck fs cat` returns raw file content, not JSON.
2. `deck fs write` requires `<path> <content>` arguments.
3. `deck fs replace` syntax is `<pattern> <replacement> <files...>`.
4. For large changes, run backup first.

## Core Commands

### List
```bash
deck fs ls [path]
```

Examples:
```bash
deck fs ls
deck fs ls /workspace
deck fs ls /workspace | jq -r '.[].name'
```

### Info
```bash
deck fs info <path>
```

Examples:
```bash
deck fs info /workspace/package.json
deck fs info /workspace/src | jq -r '.isDir'
```

### Read
```bash
deck fs cat <path>
```

Examples:
```bash
deck fs cat /workspace/README.md
deck fs cat /workspace/.env.example
```

### Write
```bash
deck fs write <path> <content>
```

Examples:
```bash
deck fs write /workspace/hello.txt "hello"
deck fs write /workspace/config.json '{"env":"dev"}'
```

### Create Folder
```bash
deck fs mkdir <path>
```

### Delete
```bash
deck fs rm <path> [--recursive] [--force]
```

### Move
```bash
deck fs mv <source> <destination>
```

## Search and Replace

### Search files by name
```bash
deck fs search <path> <pattern>
```

Example:
```bash
deck fs search /workspace "*.ts" | jq -r '.files[]'
```

### Search file content
```bash
deck fs grep <path> <pattern>
```

Example:
```bash
deck fs grep /workspace/src "TODO"
```

### Replace in files
```bash
deck fs replace <pattern> <replacement> <files...>
```

Example:
```bash
deck fs replace "oldName" "newName" /workspace/src/a.ts /workspace/src/b.ts
```

Tip:
- Use `deck fs grep` first to inspect scope.
- Use `scripts/batch-replace.sh --preview` for safer workflow.

## Common Workflows

### Inspect and edit a file

```bash
deck fs info /workspace/app/config.ts
deck fs cat /workspace/app/config.ts
deck fs write /workspace/app/config.ts "export const mode = 'prod';"
```

### Safe bulk replacement

```bash
bash scripts/backup-files.sh /workspace/app
bash scripts/batch-replace.sh /workspace/app "oldName" "newName" --preview
bash scripts/batch-replace.sh /workspace/app "oldName" "newName"
```

### Cleanup directory

```bash
deck fs search /workspace "*.tmp" | jq -r '.files[]'
deck fs rm /workspace/tmp --recursive --force
```
