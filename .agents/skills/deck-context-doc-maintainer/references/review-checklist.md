# Deck Context Docs Review Checklist

Use this checklist when auditing or updating `AGENTS.md` and `.x/*`.

## 1) Navigation and Entry Points

- `AGENTS.md` links resolve to real files.
- `.x/README.md` index includes all active guide files.
- Shared guides and app-specific guides are clearly separated.
- Historical docs are explicitly marked as historical-only.

Evidence commands:

```bash
node scripts/check_docs_entry.mjs
find .x -maxdepth 2 -type f | sort
```

## 2) Workspace and Structure Truth

- `.x/project-overview.md` workspace members match:
  - `pnpm-workspace.yaml`
  - `go.work`
  - `pyproject.toml`
- Directory map entries reflect real top-level `apps/*` and `packages/*`.

Evidence commands:

```bash
sed -n '1,120p' pnpm-workspace.yaml
sed -n '1,120p' go.work
sed -n '1,120p' pyproject.toml
find apps -mindepth 1 -maxdepth 1 -type d | sort
find packages -mindepth 1 -maxdepth 1 -type d | sort
```

## 3) Module Lifecycle Accuracy

- `.x/module-status.md` status values reflect module nature:
  - `ACTIVE`
  - `PLACEHOLDER`
  - `HISTORICAL`
  - `GENERATED`
- Generated SDK surfaces are clearly marked with regeneration guidance.

Evidence commands:

```bash
node scripts/check_docs_entry.mjs
rg -n "generated|do not edit|openapi" packages/client-daemon-ts packages/client-daemon-go
```

## 4) Guide Scope Correctness

- Shared frontend rules do not over-constrain apps with different architecture.
- Landing guidance is independent when it does not use TanStack Router/Query/Zustand.
- API, client, dashboard, pilot guides map to actual entrypoints and commands.

Evidence commands:

```bash
sed -n '1,220p' .x/guide-frontend.md
sed -n '1,220p' .x/guide-landing.md
sed -n '1,220p' apps/landing/package.json
```

## 5) Standards vs Effective Tooling

- `.x/coding-standards.md` matches current lint/tooling enforcement.
- Exception scopes mention real paths (not generic placeholders).

Evidence commands:

```bash
sed -n '1,320p' .x/coding-standards.md
sed -n '1,340p' eslint.config.js
```

## 6) Output Quality Gate

- Findings use concrete path-level evidence.
- Edits are minimal and scoped to drift.
- Final validation (`node scripts/check_docs_entry.mjs`) passes.
- Report includes residual risks and deferred follow-ups.
