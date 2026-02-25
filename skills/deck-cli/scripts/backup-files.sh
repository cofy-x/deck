#!/usr/bin/env bash
# Create timestamped backup for a path.
# Usage: bash scripts/backup-files.sh <path>

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/lib/common.sh"

check_deck_cli
check_jq

main() {
    local path="$1"

    require_arg "$path" "path"

    if ! check_path_exists "$path"; then
        error_exit "Path does not exist: $path" "PATH_NOT_FOUND" 2
    fi

    local backup_path
    backup_path=$(generate_backup_path "/tmp/backups")

    local q_source
    local q_backup
    printf -v q_source '%q' "$path"
    printf -v q_backup '%q' "$backup_path"

    local copy_command
    copy_command="sh -lc 'mkdir -p ${q_backup} && if [ -d ${q_source} ]; then tar --exclude=\".git\" --exclude=\"node_modules\" --exclude=\".next\" --exclude=\"dist\" --exclude=\"build\" --exclude=\"target\" --exclude=\".venv\" --exclude=\"__pycache__\" -C ${q_source} -cf - . | tar -C ${q_backup} -xf -; else cp -p ${q_source} ${q_backup}/; fi'"

    local copy_output
    if ! copy_output=$(deck_exec_run "$copy_command"); then
        error_exit "Backup copy command failed to execute" "BACKUP_FAILED" 4
    fi

    local copy_code
    copy_code=$(extract_exec_exit_code "$copy_output")
    if [ "$copy_code" -ne 0 ]; then
        error_exit "Backup command exited with code $copy_code" "BACKUP_FAILED" 4
    fi

    if ! check_path_exists "$backup_path"; then
        error_exit "Backup verification failed: path not found" "BACKUP_VERIFICATION_FAILED" 4
    fi

    local count_output
    local count_command
    count_command="sh -lc 'find ${q_backup} -type f | wc -l'"
    if ! count_output=$(deck_exec_run "$count_command"); then
        error_exit "Failed to count backup files" "BACKUP_COUNT_FAILED" 4
    fi

    local count_code
    count_code=$(extract_exec_exit_code "$count_output")
    if [ "$count_code" -ne 0 ]; then
        error_exit "Failed to count backup files (exit code $count_code)" "BACKUP_COUNT_FAILED" 4
    fi

    local file_count
    file_count=$(strip_exec_meta "$count_output" | tr -d '[:space:]')
    file_count="${file_count:-0}"

    local payload
    payload=$(jq -n \
        --arg source "$path" \
        --arg path "$backup_path" \
        --argjson files "$file_count" \
        '{
            backup: {
                source: $source,
                path: $path,
                files: $files
            }
        }')
    success_output "$payload"
}

if [ $# -lt 1 ]; then
    error_exit "Usage: bash backup-files.sh <path>" "INVALID_ARGUMENT" 2
fi

main "$@"
