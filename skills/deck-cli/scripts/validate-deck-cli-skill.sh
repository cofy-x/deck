#!/usr/bin/env bash
# Validate deck-cli skill docs/scripts against current CLI surface.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SKILL_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

issues=()
checks=()

add_issue() {
    issues+=("$1")
}

add_check() {
    checks+=("$1")
}

deck_available=true
if ! command -v deck >/dev/null 2>&1; then
    add_issue "Missing dependency: deck"
    deck_available=false
fi

if ! command -v jq >/dev/null 2>&1; then
    add_issue "Missing dependency: jq"
fi

required_files=(
    "$SKILL_DIR/SKILL.md"
    "$SKILL_DIR/agents/openai.yaml"
    "$SKILL_DIR/references/command-matrix.md"
    "$SKILL_DIR/references/process.md"
    "$SKILL_DIR/references/filesystem.md"
    "$SKILL_DIR/references/git.md"
    "$SKILL_DIR/references/computer-use.md"
    "$SKILL_DIR/references/system.md"
)

for file in "${required_files[@]}"; do
    if [ -f "$file" ]; then
        add_check "found: $(basename "$file")"
    else
        add_issue "Missing required file: $file"
    fi
done

if [ "$deck_available" = true ]; then
    commands=(
        "deck exec run --help"
        "deck session create --help"
        "deck session exec --help"
        "deck fs replace --help"
        "deck git status --help"
        "deck computer mouse click --help"
        "deck computer keyboard type --help"
        "deck info ports --help"
        "deck config get --help"
    )

    for cmd in "${commands[@]}"; do
        if eval "$cmd" >/dev/null 2>&1; then
            add_check "ok: $cmd"
        else
            add_issue "Command check failed: $cmd"
        fi
    done
else
    add_check "skip: command checks (deck unavailable)"
fi

scan_target_docs=(
    "$SKILL_DIR/SKILL.md"
    "$SKILL_DIR/references/process.md"
    "$SKILL_DIR/references/filesystem.md"
    "$SKILL_DIR/references/git.md"
    "$SKILL_DIR/references/computer-use.md"
    "$SKILL_DIR/references/system.md"
)

scan_target_scripts=(
    "$SKILL_DIR/scripts/health-check.sh"
    "$SKILL_DIR/scripts/diagnose.sh"
    "$SKILL_DIR/scripts/init-project.sh"
    "$SKILL_DIR/scripts/run-tests.sh"
    "$SKILL_DIR/scripts/git-safe-commit.sh"
    "$SKILL_DIR/scripts/batch-replace.sh"
    "$SKILL_DIR/scripts/backup-files.sh"
    "$SKILL_DIR/scripts/lib/common.sh"
)

scan_pattern_in_files() {
    local pattern="$1"
    shift
    local files=("$@")

    local match
    for file in "${files[@]}"; do
        if [ -f "$file" ] && grep -E -n "$pattern" "$file" >/dev/null 2>&1; then
            match=$(grep -E -n "$pattern" "$file" | head -1)
            add_issue "Legacy pattern '$pattern' found in $file ($match)"
        fi
    done
}

# Legacy command syntax checks (docs).
scan_pattern_in_files 'deck[[:space:]]+computer[[:space:]]+mouse-click' "${scan_target_docs[@]}"
scan_pattern_in_files 'deck[[:space:]]+computer[[:space:]]+mouse-move' "${scan_target_docs[@]}"
scan_pattern_in_files 'deck[[:space:]]+computer[[:space:]]+mouse-drag' "${scan_target_docs[@]}"
scan_pattern_in_files 'deck[[:space:]]+computer[[:space:]]+mouse-scroll' "${scan_target_docs[@]}"
scan_pattern_in_files 'deck[[:space:]]+computer[[:space:]]+keyboard-type' "${scan_target_docs[@]}"
scan_pattern_in_files 'deck[[:space:]]+computer[[:space:]]+keyboard-press' "${scan_target_docs[@]}"
scan_pattern_in_files 'deck[[:space:]]+computer[[:space:]]+keyboard-hotkey' "${scan_target_docs[@]}"
scan_pattern_in_files 'deck[[:space:]]+session[[:space:]]+logs[[:space:]]+<' "${scan_target_docs[@]}"
scan_pattern_in_files 'deck[[:space:]]+session[[:space:]]+exec[[:space:]]+[^\\n]*--async' "${scan_target_docs[@]}"
scan_pattern_in_files 'deck[[:space:]]+fs[[:space:]]+replace[[:space:]]+<path>' "${scan_target_docs[@]}"
scan_pattern_in_files 'deck[[:space:]]+config[[:space:]]+get[[:space:]]+daemon_url' "${scan_target_docs[@]}"
scan_pattern_in_files 'deck[[:space:]]+config[[:space:]]+set[[:space:]]+daemon_url' "${scan_target_docs[@]}"

# Legacy field parsing checks (scripts).
scan_pattern_in_files '\.stdout\b' "${scan_target_scripts[@]}"
scan_pattern_in_files '\.staged\b' "${scan_target_scripts[@]}"
scan_pattern_in_files '\.modified\b' "${scan_target_scripts[@]}"
scan_pattern_in_files '\.untracked\b' "${scan_target_scripts[@]}"
scan_pattern_in_files '\.branch\b' "${scan_target_scripts[@]}"
scan_pattern_in_files '\.image\b' "${scan_target_scripts[@]}"

if [ "${#issues[@]}" -gt 0 ]; then
    jq -n \
        --argjson issues "$(printf '%s\n' "${issues[@]}" | jq -R . | jq -s .)" \
        --argjson checks "$(printf '%s\n' "${checks[@]}" | jq -R . | jq -s .)" \
        '{status:"error", issues:$issues, checks:$checks}' >&2
    exit 4
fi

jq -n \
    --argjson checks "$(printf '%s\n' "${checks[@]}" | jq -R . | jq -s .)" \
    '{status:"success", checks:$checks}'
