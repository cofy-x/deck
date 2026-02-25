#!/usr/bin/env bash
# Comprehensive diagnostics for deck CLI environment.
# Usage: bash scripts/diagnose.sh

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/lib/common.sh"

check_deck_cli
check_jq

main() {
    log_info "Starting diagnostics"

    local diagnostics='{}'
    local workdir="unknown"
    local homedir="unknown"
    local disk_space="unavailable"
    local port_count=0
    local session_count=0

    local workdir_json
    if workdir_json=$(deck_json info workdir); then
        workdir=$(echo "$workdir_json" | jq -r '.workdir // "unknown"')
        diagnostics=$(echo "$diagnostics" | jq --arg dir "$workdir" '. + {workdir: $dir}')
    else
        diagnostics=$(echo "$diagnostics" | jq '. + {workdir: "error"}')
    fi

    local homedir_json
    if homedir_json=$(deck_json info homedir); then
        homedir=$(echo "$homedir_json" | jq -r '.homedir // "unknown"')
        diagnostics=$(echo "$diagnostics" | jq --arg dir "$homedir" '. + {homedir: $dir}')
    else
        diagnostics=$(echo "$diagnostics" | jq '. + {homedir: "error"}')
    fi

    if [ "$workdir" != "unknown" ]; then
        disk_space=$(check_disk_space "$workdir" || echo "unavailable")
    fi
    diagnostics=$(echo "$diagnostics" | jq --arg disk "$disk_space" '. + {disk_space: $disk}')

    local ports_json
    if ports_json=$(deck_json info ports); then
        port_count=$(echo "$ports_json" | jq '.ports // [] | length')
        diagnostics=$(echo "$diagnostics" | jq --argjson count "$port_count" '. + {active_ports: $count}')
    else
        diagnostics=$(echo "$diagnostics" | jq '. + {active_ports: "error"}')
    fi

    local sessions_json
    if sessions_json=$(deck_json session list); then
        session_count=$(echo "$sessions_json" | jq 'length')
        diagnostics=$(echo "$diagnostics" | jq --argjson count "$session_count" '. + {active_sessions: $count}')
    else
        diagnostics=$(echo "$diagnostics" | jq '. + {active_sessions: "error"}')
    fi

    local fs_test="ok"
    if [ "$workdir" = "unknown" ] || ! deck_json fs ls "$workdir" >/dev/null 2>&1; then
        fs_test="failed"
    fi
    diagnostics=$(echo "$diagnostics" | jq --arg test "$fs_test" '. + {fs_operations: $test}')

    local git_test="ok"
    local git_output
    if ! git_output=$(deck_exec_run "git --version"); then
        git_test="failed"
    else
        local git_code
        git_code=$(extract_exec_exit_code "$git_output")
        if [ "$git_code" -ne 0 ]; then
            git_test="git_not_available"
        fi
    fi
    diagnostics=$(echo "$diagnostics" | jq --arg test "$git_test" '. + {git_operations: $test}')

    local recs
    recs=$(recommend_actions "$disk_space" "$port_count" "$session_count")
    diagnostics=$(echo "$diagnostics" | jq --argjson recs "$recs" '. + {recommendations: $recs}')

    success_output "$diagnostics"
}

main
