#!/usr/bin/env bash
set -euo pipefail

ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
cd "$ROOT"

echo "== Repo =="
echo "$ROOT"
echo

echo "== Core context docs =="
for f in AGENTS.md .x/README.md .x/project-overview.md .x/module-status.md .x/coding-standards.md; do
  if [[ -f "$f" ]]; then
    echo "OK  $f"
  else
    echo "MISS $f"
  fi
done
echo

echo "== .x guide list =="
find .x -maxdepth 1 -type f -name 'guide-*.md' | sort
echo

echo "== Workspace manifests (top section) =="
echo "--- pnpm-workspace.yaml"
sed -n '1,120p' pnpm-workspace.yaml
echo "--- go.work"
sed -n '1,120p' go.work
echo "--- pyproject.toml"
sed -n '1,120p' pyproject.toml
echo

echo "== Top-level modules =="
echo "--- apps"
find apps -mindepth 1 -maxdepth 1 -type d | sort
echo "--- packages"
find packages -mindepth 1 -maxdepth 1 -type d | sort
echo

echo "== Link and matrix check =="
if [[ -f scripts/check_docs_entry.mjs ]]; then
  node scripts/check_docs_entry.mjs
else
  echo "SKIP scripts/check_docs_entry.mjs not found"
fi
echo

echo "== Historical boundary markers =="
rg -n "historical|HISTORICAL|v0.1" AGENTS.md .x/README.md .x/v0.1/README.md || true
echo

echo "== Audit complete =="
