# Deck CLI Helper Scripts

These scripts wrap `deck` CLI commands into reusable and safer workflows.

## Implemented Scripts

- `health-check.sh`: Validate daemon connectivity and baseline capabilities.
- `diagnose.sh`: Collect environment diagnostics and recommendations.
- `init-project.sh`: Clone repository and install dependencies by detected project type.
- `run-tests.sh`: Run tests with structured reporting.
- `git-safe-commit.sh`: Commit with staged-file and sensitive-path checks.
- `batch-replace.sh`: Search + preview + replace across files, with backup integration.
- `code-search.sh`: Grouped grep output by file.
- `backup-files.sh`: Timestamped backup copy under `/tmp/backups`.
- `validate-deck-cli-skill.sh`: Validate docs and scripts against current CLI surface.

## Output Contract

Successful scripts print compact JSON to stdout:

```json
{"status":"success", "...":"..."}
```

Failures print JSON to stderr and exit non-zero:

```json
{"status":"error", "error":"...", "code":"..."}
```

## Common Usage

### Check environment

```bash
bash scripts/health-check.sh
bash scripts/diagnose.sh
```

### Initialize a project

```bash
bash scripts/init-project.sh https://github.com/user/repo.git /workspace/repo
```

### Run tests

```bash
bash scripts/run-tests.sh /workspace/repo
bash scripts/run-tests.sh /workspace/repo "npm run test:unit"
```

### Safe replace workflow

```bash
bash scripts/batch-replace.sh /workspace/repo "OldName" "NewName" --preview
bash scripts/batch-replace.sh /workspace/repo "OldName" "NewName"
```

### Safe commit

```bash
bash scripts/git-safe-commit.sh /workspace/repo "feat: update naming" "Dev" "dev@example.com"
```

## Validation

Run skill-level validation after updates:

```bash
bash scripts/validate-deck-cli-skill.sh
```
