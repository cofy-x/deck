#!/usr/bin/env bash
# Create git commit with safety checks.
# Usage: bash scripts/git-safe-commit.sh <repo-path> <message> [author] [email]

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/lib/common.sh"

check_deck_cli
check_jq

get_staged_files_list() {
    local repo_path="$1"
    local status_json="$2"
    if [ -n "$status_json" ]; then
        get_staged_files "$status_json"
        return 0
    fi

    local q_repo
    printf -v q_repo '%q' "$repo_path"
    local fallback_output
    if ! fallback_output=$(deck_exec_run "sh -lc 'cd ${q_repo} && git diff --cached --name-only'"); then
        return 1
    fi

    local fallback_code
    fallback_code=$(extract_exec_exit_code "$fallback_output")
    if [ "$fallback_code" -ne 0 ]; then
        return 1
    fi

    strip_exec_meta "$fallback_output" | sed '/^[[:space:]]*$/d'

    return 0
}

count_staged_files() {
    local repo_path="$1"
    local status_json="$2"

    if [ -n "$status_json" ]; then
        echo "$status_json" | jq '[.fileStatus[] | select(.staging != "Unmodified")] | length'
        return 0
    fi

    local q_repo
    printf -v q_repo '%q' "$repo_path"
    local fallback_output
    if ! fallback_output=$(deck_exec_run "sh -lc 'cd ${q_repo} && git diff --cached --name-only'"); then
        return 1
    fi

    local fallback_code
    fallback_code=$(extract_exec_exit_code "$fallback_output")
    if [ "$fallback_code" -ne 0 ]; then
        return 1
    fi

    strip_exec_meta "$fallback_output" | sed '/^[[:space:]]*$/d' | wc -l | tr -d '[:space:]'
}

main() {
    local repo_path="$1"
    local message="$2"
    local author="${3:-AI Agent}"
    local email="${4:-agent@example.com}"

    require_arg "$repo_path" "repo-path"
    require_arg "$message" "commit-message"

    if ! check_path_exists "$repo_path"; then
        error_exit "Repository path does not exist: $repo_path" "PATH_NOT_FOUND" 2
    fi

    if ! validate_email "$email"; then
        error_exit "Invalid email format: $email" "INVALID_EMAIL" 2
    fi

    local status_json=""
    if ! status_json=$(deck_json git status "$repo_path"); then
        status_json=""
    fi

    local staged_files=()
    local staged_lines
    if ! staged_lines=$(get_staged_files_list "$repo_path" "$status_json"); then
        error_exit "Failed to read git status" "GIT_STATUS_FAILED" 4
    fi
    while IFS= read -r file; do
        [ -n "$file" ] || continue
        staged_files+=("$file")
    done <<< "$staged_lines"

    if [ "${#staged_files[@]}" -eq 0 ]; then
        error_exit "No staged files found. Run 'deck git add' first." "NO_STAGED_FILES" 4
    fi

    local sensitive_pattern='(^|/)(\.env($|\.)|\.pem$|\.key$|\.p12$|\.pfx$|id_rsa|credentials|secret|token|password|api[_-]?key)'
    local sensitive=()
    local file
    for file in "${staged_files[@]}"; do
        if echo "$file" | grep -Eiq "$sensitive_pattern"; then
            sensitive+=("$file")
        fi
    done

    if [ "${#sensitive[@]}" -gt 0 ]; then
        error_exit "Sensitive-looking staged files detected: ${sensitive[*]}" "SENSITIVE_FILES_DETECTED" 4
    fi

    local commit_output
    if ! commit_output=$(
        GIT_AUTHOR_NAME="$author" \
        GIT_AUTHOR_EMAIL="$email" \
        GIT_COMMITTER_NAME="$author" \
        GIT_COMMITTER_EMAIL="$email" \
        deck_cmd git commit "$repo_path" --message "$message" 2>&1
    ); then
        error_exit "Commit failed: $commit_output" "COMMIT_FAILED" 4
    fi

    local commit_json
    commit_json=$(extract_json_payload "$commit_output")
    local commit_hash="unknown"
    if [ -n "$commit_json" ] && echo "$commit_json" | jq -e '.hash' >/dev/null 2>&1; then
        commit_hash=$(echo "$commit_json" | jq -r '.hash')
    fi

    local new_status_json=""
    if ! new_status_json=$(deck_json git status "$repo_path"); then
        new_status_json=""
    fi
    local staged_after
    if ! staged_after=$(count_staged_files "$repo_path" "$new_status_json"); then
        error_exit "Commit created but status verification failed" "COMMIT_VERIFICATION_FAILED" 4
    fi
    if [ "$staged_after" -ne 0 ]; then
        error_exit "Commit verification failed: staged entries remain" "COMMIT_VERIFICATION_FAILED" 4
    fi

    local files_json
    files_json=$(printf '%s\n' "${staged_files[@]}" | jq -R . | jq -s .)

    local payload
    payload=$(jq -n \
        --arg hash "$commit_hash" \
        --arg message "$message" \
        --arg author "$author" \
        --arg email "$email" \
        --argjson count "${#staged_files[@]}" \
        --argjson files "$files_json" \
        '{
            commit: {
                hash: $hash,
                message: $message,
                author: $author,
                email: $email,
                files: $count,
                fileList: $files
            }
        }')
    success_output "$payload"
}

if [ $# -lt 2 ]; then
    error_exit "Usage: bash git-safe-commit.sh <repo-path> <message> [author] [email]" "INVALID_ARGUMENT" 2
fi

main "$@"
