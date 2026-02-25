#!/usr/bin/env bash
# Safe find-and-replace across multiple files.
# Usage: bash scripts/batch-replace.sh <path> <pattern> <replacement> [--preview]

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/lib/common.sh"

check_deck_cli
check_jq

main() {
    local path="$1"
    local pattern="$2"
    local replacement="$3"
    local preview_mode="false"

    if [ $# -ge 4 ] && [ "$4" = "--preview" ]; then
        preview_mode="true"
    fi

    require_arg "$path" "path"
    require_arg "$pattern" "pattern"
    require_arg "$replacement" "replacement"

    if ! check_path_exists "$path"; then
        error_exit "Path does not exist: $path" "PATH_NOT_FOUND" 2
    fi

    local grep_json
    if ! grep_json=$(deck_json fs grep "$path" "$pattern"); then
        error_exit "Failed to search for pattern" "SEARCH_FAILED" 4
    fi

    local matching_files=()
    while IFS= read -r file; do
        [ -n "$file" ] || continue
        matching_files+=("$file")
    done < <(echo "$grep_json" | jq -r '.[].file' | awk '!seen[$0]++')

    if [ "${#matching_files[@]}" -eq 0 ]; then
        success_output '{"changed":0,"files":[]}'
        return 0
    fi

    local files_json
    files_json=$(printf '%s\n' "${matching_files[@]}" | jq -R . | jq -s .)

    if [ "$preview_mode" = "true" ]; then
        local preview_payload
        preview_payload=$(jq -n \
            --arg pattern "$pattern" \
            --arg replacement "$replacement" \
            --argjson count "${#matching_files[@]}" \
            --argjson files "$files_json" \
            '{
                preview: true,
                pattern: $pattern,
                replacement: $replacement,
                matchingFiles: $count,
                files: $files
            }')
        success_output "$preview_payload"
        return 0
    fi

    local backup_output
    local backup_path=""
    if backup_output=$(bash "$SCRIPT_DIR/backup-files.sh" "$path"); then
        backup_path=$(echo "$backup_output" | jq -r '.backup.path // empty')
    fi

    local replace_output
    if ! replace_output=$(deck_cmd fs replace "$pattern" "$replacement" "${matching_files[@]}" 2>&1); then
        error_exit "Replace command failed: $replace_output" "REPLACE_FAILED" 4
    fi

    local replace_json
    replace_json=$(extract_json_payload "$replace_output")
    if [ -z "$replace_json" ] || ! echo "$replace_json" | jq empty >/dev/null 2>&1; then
        error_exit "Replace command returned non-JSON output" "INVALID_REPLACE_OUTPUT" 4
    fi

    local changed_count
    changed_count=$(echo "$replace_json" | jq '[.[] | select(.success == true)] | length')
    local changed_files
    changed_files=$(echo "$replace_json" | jq '[.[] | select(.success == true and .file != null) | .file]')

    local payload
    payload=$(jq -n \
        --argjson changed "$changed_count" \
        --argjson files "$changed_files" \
        --arg backup "$backup_path" \
        '{
            changed: $changed,
            files: $files,
            backup: $backup
        }')
    success_output "$payload"
}

if [ $# -lt 3 ]; then
    error_exit "Usage: bash batch-replace.sh <path> <pattern> <replacement> [--preview]" "INVALID_ARGUMENT" 2
fi

main "$@"
