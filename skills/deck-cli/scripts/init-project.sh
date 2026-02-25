#!/usr/bin/env bash
# Clone a repository and initialize dependencies.
# Usage: bash scripts/init-project.sh <repo-url> <target-path>

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/lib/common.sh"

check_deck_cli
check_jq

REPO_URL="${1:-}"
TARGET_PATH="${2:-}"

usage() {
    cat >&2 <<'USAGE'
Usage: bash scripts/init-project.sh <repo-url> <target-path>

Arguments:
  repo-url      Git repository URL.
  target-path   Target directory path (must not exist or be empty).
USAGE
    exit 2
}

main() {
    [ -n "$REPO_URL" ] || usage
    [ -n "$TARGET_PATH" ] || usage

    log_info "Initializing project"

    if check_path_exists "$TARGET_PATH"; then
        if ! check_dir_empty "$TARGET_PATH"; then
            error_exit "Target path is not empty: $TARGET_PATH" "PATH_NOT_EMPTY" 4
        fi
    fi

    local clone_output
    if ! clone_output=$(deck_cmd git clone "$REPO_URL" "$TARGET_PATH" 2>&1); then
        error_exit "Git clone failed: $clone_output" "CLONE_FAILED" 4
    fi

    local project_type
    project_type=$(detect_project_type "$TARGET_PATH")

    local package_manager="unknown"
    local deps_status="skipped"
    local warnings=()

    if [ "$project_type" != "unknown" ]; then
        package_manager=$(get_package_manager "$project_type")
        local install_command
        install_command=$(get_install_command "$project_type")

        if [ -n "$install_command" ]; then
            local install_output
            if install_output=$(deck_exec_run "$install_command" "$TARGET_PATH"); then
                local install_code
                install_code=$(extract_exec_exit_code "$install_output")
                if [ "$install_code" -eq 0 ]; then
                    deps_status="installed"
                else
                    deps_status="failed"
                    warnings+=("Dependency installation failed with exit code $install_code")
                fi
            else
                deps_status="failed"
                warnings+=("Dependency installation command failed to execute")
            fi
        fi
    else
        warnings+=("Project type not recognized; dependencies were not installed")
    fi

    local file_count=0
    local ls_json
    if ls_json=$(deck_json fs ls "$TARGET_PATH"); then
        file_count=$(echo "$ls_json" | jq 'length')
    fi

    local current_branch="unknown"
    local status_json
    if status_json=$(deck_json git status "$TARGET_PATH"); then
        current_branch=$(echo "$status_json" | jq -r '.currentBranch // "unknown"')
    fi

    if [ ${#warnings[@]} -gt 0 ]; then
        local payload
        payload=$(jq -n \
            --arg path "$TARGET_PATH" \
            --arg type "$project_type" \
            --arg pm "$package_manager" \
            --arg deps "$deps_status" \
            --arg repo "$REPO_URL" \
            --arg branch "$current_branch" \
            --argjson files "$file_count" \
            --argjson warnings "$(printf '%s\n' "${warnings[@]}" | jq -R . | jq -s .)" \
            '{
                project: {
                    path: $path,
                    type: $type,
                    packageManager: $pm,
                    dependencies: $deps,
                    repository: $repo,
                    branch: $branch,
                    fileCount: $files
                },
                warnings: $warnings
            }')
        success_output "$payload"
    else
        local payload
        payload=$(jq -n \
            --arg path "$TARGET_PATH" \
            --arg type "$project_type" \
            --arg pm "$package_manager" \
            --arg deps "$deps_status" \
            --arg repo "$REPO_URL" \
            --arg branch "$current_branch" \
            --argjson files "$file_count" \
            '{
                project: {
                    path: $path,
                    type: $type,
                    packageManager: $pm,
                    dependencies: $deps,
                    repository: $repo,
                    branch: $branch,
                    fileCount: $files
                }
            }')
        success_output "$payload"
    fi
}

main
