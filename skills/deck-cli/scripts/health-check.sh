#!/usr/bin/env bash
# Verify deck daemon connectivity and basic operations.
# Usage: bash scripts/health-check.sh

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/lib/common.sh"

check_deck_cli
check_jq

main() {
    local health="healthy"
    local version
    local workdir
    local homedir
    local ports_count=0
    local fs_status="ok"
    local exec_status="ok"

    log_info "Starting health check"

    local version_json
    if ! version_json=$(deck_json info version); then
        error_exit "Cannot connect to daemon" "DAEMON_UNREACHABLE" 1
    fi
    version=$(echo "$version_json" | jq -r '.version // "unknown"')

    local workdir_json
    if ! workdir_json=$(deck_json info workdir); then
        workdir="unknown"
        health="degraded"
    else
        workdir=$(echo "$workdir_json" | jq -r '.workdir // "unknown"')
    fi

    local homedir_json
    if ! homedir_json=$(deck_json info homedir); then
        homedir="unknown"
        health="degraded"
    else
        homedir=$(echo "$homedir_json" | jq -r '.homedir // "unknown"')
    fi

    local ports_json
    if ports_json=$(deck_json info ports); then
        ports_count=$(echo "$ports_json" | jq '.ports // [] | length')
    else
        health="degraded"
    fi

    if [ "$workdir" = "unknown" ] || ! deck_json fs ls "$workdir" >/dev/null 2>&1; then
        fs_status="error"
        health="degraded"
    fi

    local exec_output
    if ! exec_output=$(deck_exec_run "echo deck-health-check"); then
        exec_status="error"
        health="degraded"
    else
        local exec_code
        exec_code=$(extract_exec_exit_code "$exec_output")
        if [ "$exec_code" -ne 0 ] || ! strip_exec_meta "$exec_output" | grep -q "deck-health-check"; then
            exec_status="error"
            health="degraded"
        fi
    fi

    local payload
    payload=$(jq -n \
        --arg health "$health" \
        --arg version "$version" \
        --arg workdir "$workdir" \
        --arg homedir "$homedir" \
        --argjson ports "$ports_count" \
        --arg fs_status "$fs_status" \
        --arg exec_status "$exec_status" \
        '{
            health: $health,
            daemon: {
                version: $version,
                reachable: true
            },
            system: {
                workdir: $workdir,
                homedir: $homedir,
                activePorts: $ports
            },
            tests: {
                fileSystem: $fs_status,
                commandExecution: $exec_status
            },
            timestamp: (now | strftime("%Y-%m-%dT%H:%M:%SZ"))
        }')
    success_output "$payload"

    case "$health" in
        healthy) exit 0 ;;
        degraded) exit 2 ;;
        *) exit 1 ;;
    esac
}

main
