#!/usr/bin/env bash
# Enhanced code search with context and formatting
# Usage: bash scripts/code-search.sh <path> <query> [context-lines]

set -euo pipefail

# Source common utilities
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/lib/common.sh"

# Check dependencies
check_deck_cli
check_jq

main() {
    local path="$1"
    local query="$2"
    local context_lines="${3:-2}"

    # Validate required arguments
    require_arg "$path" "path"
    require_arg "$query" "query"

    if ! check_path_exists "$path"; then
        error_exit "Path does not exist: $path" "PATH_NOT_FOUND" 2
    fi

    log_info "Searching in: $path"
    log_info "Query: $query"
    log_info "Context lines: $context_lines"

    # Execute grep search
    local grep_output
    grep_output=$(deck fs grep "$path" "$query" 2>&1 || echo "[]")

    # Parse results
    local results
    if echo "$grep_output" | jq -e 'type == "array"' &>/dev/null; then
        results="$grep_output"
    else
        # If output is not JSON array, assume no results
        results="[]"
    fi

    local result_count
    result_count=$(echo "$results" | jq 'length')

    log_info "Found $result_count result(s)"

    if [ "$result_count" -eq 0 ]; then
        success_output '{"matches": 0, "results": []}'
        return 0
    fi

    # Group results by file and format
    local formatted_results
    formatted_results=$(echo "$results" | jq -c \
        --argjson context "$context_lines" \
        'group_by(.file) | map({
            file: .[0].file,
            matches: length,
            lines: map({
                line: .line,
                content: .content
            })
        })')

    # Build final output
    local output
    output=$(jq -n \
        --argjson count "$result_count" \
        --argjson results "$formatted_results" \
        --arg query "$query" \
        '{
            matches: $count,
            query: $query,
            results: $results
        }')

    success_output "$output"
}

# Validate arguments
if [ $# -lt 2 ]; then
    error_exit "Usage: bash code-search.sh <path> <query> [context-lines]" "INVALID_ARGUMENT" 2
fi

# Run main function
main "$@"
