# Git Commands

Use these commands for repository lifecycle, branching, and synchronization.

## TOC
- Quick rules
- Core commands
- Parse `git status` correctly
- Common workflows

## Quick Rules

1. Run `deck git status` before mutations.
2. `deck git commit` requires `--message --author --email` unless env fallback is configured in CLI.
3. Parse status via `currentBranch` and `fileStatus[]`.
4. Do not rely on deprecated fields like `.staged` or `.modified`.

## Core Commands

### Clone
```bash
deck git clone <url> <path>
```

### Status
```bash
deck git status [path]
```

### Add
```bash
deck git add <path> <files...>
```

Examples:
```bash
deck git add /workspace/repo .
deck git add /workspace/repo src/main.ts README.md
```

### Commit
```bash
deck git commit <path> --message <msg> --author <name> --email <email>
```

### Branches
```bash
deck git branches [path]
deck git branch <path> <name>
deck git checkout <path> <branch>
```

### Sync
```bash
deck git pull <path>
deck git push <path>
```

## Parse git status correctly

`deck git status` returns a JSON object similar to:

```json
{
  "currentBranch": "main",
  "fileStatus": [
    {"name":"src/app.ts","staging":"Added","worktree":"Unmodified","extra":""},
    {"name":"README.md","staging":"Unmodified","worktree":"Modified","extra":""}
  ]
}
```

Useful queries:

```bash
# Current branch
deck git status /workspace/repo | jq -r '.currentBranch'

# Staged files
deck git status /workspace/repo | jq -r '.fileStatus[] | select(.staging != "Unmodified") | .name'

# Worktree-changed files
deck git status /workspace/repo | jq -r '.fileStatus[] | select(.worktree != "Unmodified") | .name'
```

## Common Workflows

### Basic commit

```bash
deck git status /workspace/repo
deck git add /workspace/repo .
deck git commit /workspace/repo --message "feat: add auth" --author "Dev" --email "dev@example.com"
deck git push /workspace/repo
```

### Feature branch

```bash
deck git branch /workspace/repo feature/new-api
deck git checkout /workspace/repo feature/new-api
deck git status /workspace/repo
deck git add /workspace/repo .
deck git commit /workspace/repo --message "feat: implement api" --author "Dev" --email "dev@example.com"
deck git push /workspace/repo
```

### Safer commit helper

```bash
bash scripts/git-safe-commit.sh /workspace/repo "fix: resolve race condition" "Dev" "dev@example.com"
```
