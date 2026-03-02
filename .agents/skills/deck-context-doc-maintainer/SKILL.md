---
name: deck-context-doc-maintainer
description: |
  Audit and maintain AI-agent context documentation for the deck repository.
  Use when work involves AGENTS.md, .x/* guides, module lifecycle/status docs,
  navigation/index links, historical-vs-current boundaries, or verifying that
  context docs match real repo structure, workspace manifests, commands, and
  active module behavior.
---

# Deck Context Doc Maintainer

Keep AI-facing docs accurate, navigable, and aligned with repository truth.

Primary targets:
- `AGENTS.md`
- `.x/README.md`
- `.x/project-overview.md`
- `.x/module-status.md`
- `.x/guide-*.md`
- `.x/v0.1/*` boundary wording (historical-only intent)

## Workflow

1. Run baseline audit:

```bash
bash skills/deck-context-doc-maintainer/scripts/audit-context.sh
```

2. Classify drift by type:
- Navigation drift: broken/missing entry links in `AGENTS.md` and `.x/README.md`.
- Scope drift: guide scope does not match real app architecture.
- Workspace drift: `.x/project-overview.md` differs from `pnpm-workspace.yaml`, `go.work`, `pyproject.toml`.
- Lifecycle drift: `.x/module-status.md` status is inconsistent with generated/placeholder/active reality.
- Standards drift: `.x/coding-standards.md` conflicts with effective lint/tool rules.
- Historical boundary drift: historical docs are presented like current behavior.

3. Gather hard evidence before edits:
- Use manifests and package metadata as source of truth.
- Use exact file paths and command output snippets.
- Prefer `rg` and `find` over manual scanning.

4. Apply minimal, high-signal edits:
- Keep docs in English.
- Preserve existing style and relative links.
- Update only inconsistent claims; avoid broad rewrites.
- Make historical boundaries explicit where needed.

5. Re-validate:

```bash
node scripts/check_docs_entry.mjs
```

6. Report outcomes with:
- Findings list (severity + file + rationale).
- Files updated.
- Validation results.
- Residual risks or deferred follow-ups.

## Decision Rules

- Treat repo config and code as canonical over prose docs.
- Treat generated surfaces as generated unless explicit override exists.
- If a doc statement cannot be proven from repo evidence, rephrase or remove it.
- Keep differences between shared guide vs app-specific guide explicit.
- Do not edit unrelated product or implementation code during doc alignment work.

## Quick Commands

```bash
# Baseline context audit
bash skills/deck-context-doc-maintainer/scripts/audit-context.sh

# Link and module matrix validation
node scripts/check_docs_entry.mjs

# Quick workspace truth check
sed -n '1,120p' pnpm-workspace.yaml
sed -n '1,120p' go.work
sed -n '1,120p' pyproject.toml
```

## References

- Detailed checklist: `references/review-checklist.md`
- Audit helper: `scripts/audit-context.sh`

Use the checklist when generating review findings or implementation plans for doc alignment.
