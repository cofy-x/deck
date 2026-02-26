#!/usr/bin/env bash

# Shared helpers for deck-cli skill integration tests.

if [[ -t 1 ]]; then
    RED='\033[0;31m'
    GREEN='\033[0;32m'
    YELLOW='\033[1;33m'
    NC='\033[0m'
else
    RED=''
    GREEN=''
    YELLOW=''
    NC=''
fi

log() {
    local level="$1"
    shift
    printf '[%s] %b[%s]%b %s\n' "$(date +'%Y-%m-%d %H:%M:%S')" "$GREEN" "$level" "$NC" "$*" >&2
}

log_info() {
    log "INFO" "$@"
}

log_warn() {
    printf '[%s] %b[WARN]%b %s\n' "$(date +'%Y-%m-%d %H:%M:%S')" "$YELLOW" "$NC" "$*" >&2
}

log_error() {
    printf '[%s] %b[ERROR]%b %s\n' "$(date +'%Y-%m-%d %H:%M:%S')" "$RED" "$NC" "$*" >&2
}

require_cmd() {
    local cmd="$1"
    if ! command -v "$cmd" >/dev/null 2>&1; then
        log_error "Missing required command: $cmd"
        return 1
    fi
}

run_capture() {
    local stdout_file="$1"
    local stderr_file="$2"
    shift 2

    set +e
    "$@" >"$stdout_file" 2>"$stderr_file"
    local code=$?
    set -e
    echo "$code"
}

run_capture_with_timeout() {
    local timeout_sec="$1"
    local stdout_file="$2"
    local stderr_file="$3"
    shift 3

    if ! [ "$timeout_sec" -gt 0 ] 2>/dev/null; then
        timeout_sec=1
    fi

    "$@" >"$stdout_file" 2>"$stderr_file" &
    local cmd_pid=$!
    local start_ts
    local now_ts
    local elapsed
    local timed_out=0
    start_ts="$(date +%s)"

    while kill -0 "$cmd_pid" >/dev/null 2>&1; do
        now_ts="$(date +%s)"
        elapsed=$((now_ts - start_ts))
        if [ "$elapsed" -ge "$timeout_sec" ]; then
            timed_out=1
            kill "$cmd_pid" >/dev/null 2>&1 || true
            sleep 1
            if kill -0 "$cmd_pid" >/dev/null 2>&1; then
                kill -9 "$cmd_pid" >/dev/null 2>&1 || true
            fi
            break
        fi
        sleep 1
    done

    set +e
    wait "$cmd_pid" >/dev/null 2>&1
    local code=$?
    set -e

    if [ "$timed_out" -eq 1 ]; then
        code=124
    fi

    echo "$code"
}

json_payload_from_file() {
    local file="$1"
    local payload

    payload="$(awk '
        BEGIN { capture = 0 }
        /^[[:space:]]*\{/ { capture = 1 }
        capture { print }
    ' "$file")"

    if [ -n "$payload" ] && echo "$payload" | jq empty >/dev/null 2>&1; then
        printf '%s\n' "$payload"
        return 0
    fi

    payload="$(awk '
        BEGIN { capture = 0 }
        /^[[:space:]]*\[/ { capture = 1 }
        capture { print }
    ' "$file")"

    if [ -n "$payload" ] && echo "$payload" | jq empty >/dev/null 2>&1; then
        printf '%s\n' "$payload"
        return 0
    fi

    return 1
}

assert_json_payload() {
    local file="$1"
    local payload
    payload="$(json_payload_from_file "$file")"
    if [ -z "$payload" ]; then
        return 1
    fi
    echo "$payload" | jq empty >/dev/null 2>&1
}

assert_json_expr() {
    local file="$1"
    local expr="$2"
    local payload
    payload="$(json_payload_from_file "$file")"
    if [ -z "$payload" ]; then
        return 1
    fi
    echo "$payload" | jq -e "$expr" >/dev/null 2>&1
}

print_failure_context() {
    local name="$1"
    local exit_code="$2"
    local stdout_file="$3"
    local stderr_file="$4"

    log_error "Case failed: ${name} (exit=${exit_code})"
    if [ -s "$stdout_file" ]; then
        log_error "stdout:"
        sed -n '1,120p' "$stdout_file" >&2
    fi
    if [ -s "$stderr_file" ]; then
        log_error "stderr:"
        sed -n '1,120p' "$stderr_file" >&2
    fi
}

remove_container_if_exists() {
    local container="$1"
    if docker ps -a --format '{{.Names}}' | grep -qx "$container"; then
        docker rm -f "$container" >/dev/null 2>&1 || true
    fi
}

dump_container_logs() {
    local container="$1"
    local tail_lines="${2:-120}"
    if docker ps -a --format '{{.Names}}' | grep -qx "$container"; then
        log_warn "Last ${tail_lines} lines from container ${container}:"
        docker logs --tail "$tail_lines" "$container" 2>&1 || true
    else
        log_warn "Container not found for log dump: ${container}"
    fi
}
