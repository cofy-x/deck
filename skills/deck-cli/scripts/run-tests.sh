#!/usr/bin/env bash
# Execute test suite with structured reporting.
# Usage: bash scripts/run-tests.sh <project-path> [test-command]

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/lib/common.sh"

check_deck_cli
check_jq

main() {
    local project_path="$1"
    local test_command="${2:-}"

    require_arg "$project_path" "project-path"

    if ! check_path_exists "$project_path"; then
        error_exit "Project path does not exist: $project_path" "PATH_NOT_FOUND" 2
    fi

    if [ -z "$test_command" ]; then
        local project_type
        project_type=$(detect_project_type "$project_path")
        test_command=$(get_test_command "$project_type")
        if [ -z "$test_command" ]; then
            error_exit "Could not auto-detect test command for project type: $project_type" "UNKNOWN_PROJECT_TYPE" 4
        fi
    fi

    log_info "Running tests: $test_command"

    local start_time
    start_time=$(date +%s)

    local exec_output
    if ! exec_output=$(deck_exec_run "$test_command" "$project_path"); then
        error_exit "Failed to execute test command" "EXECUTION_FAILED" 4
    fi

    local end_time
    end_time=$(date +%s)
    local duration=$((end_time - start_time))

    local exit_code
    exit_code=$(extract_exec_exit_code "$exec_output")

    local raw_output
    raw_output=$(strip_exec_meta "$exec_output")

    local project_type
    project_type=$(detect_project_type "$project_path")
    local framework
    framework=$(detect_test_framework "$project_type")
    local parsed
    parsed=$(parse_test_output "$raw_output" "$framework")

    local payload
    payload=$(jq -n \
        --arg command "$test_command" \
        --arg framework "$framework" \
        --arg duration "${duration}s" \
        --argjson exitCode "$exit_code" \
        --arg output "$raw_output" \
        --argjson tests "$parsed" \
        '{
            command: $command,
            framework: $framework,
            duration: $duration,
            exitCode: $exitCode,
            tests: $tests,
            rawOutput: $output
        }')

    if [ "$exit_code" -ne 0 ]; then
        echo "$payload" | jq -c '{status:"error", code:"TESTS_FAILED"} + .' >&2
        exit 4
    fi

    success_output "$payload"
}

if [ $# -lt 1 ]; then
    error_exit "Usage: bash run-tests.sh <project-path> [test-command]" "INVALID_ARGUMENT" 2
fi

main "$@"
