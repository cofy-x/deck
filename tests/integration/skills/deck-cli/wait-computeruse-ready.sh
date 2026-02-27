#!/usr/bin/env bash

# Wait until /computeruse/status returns HTTP 200 and status active|partial.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${SCRIPT_DIR}/lib/helpers.sh"

: "${DECK_SKILL_TEST_CONTAINER_NAME:=deck-desktop-sandbox-ai-skill-test}"
: "${DECK_SKILL_TEST_TIMEOUT_SEC:=180}"
: "${DECK_SKILL_TEST_START_RETRY_INTERVAL_SEC:=10}"
: "${HOST_DAEMON_PORT:=13280}"

START_URL="http://localhost:${HOST_DAEMON_PORT}/computeruse/start"
STATUS_URL="http://localhost:${HOST_DAEMON_PORT}/computeruse/status"
DEADLINE=$((SECONDS + DECK_SKILL_TEST_TIMEOUT_SEC))
LAST_BODY_FILE="$(mktemp "${TMPDIR:-/tmp}/deck-skill-status.XXXXXX")"
START_BODY_FILE="$(mktemp "${TMPDIR:-/tmp}/deck-skill-start.XXXXXX")"
trap 'rm -f "$LAST_BODY_FILE" "$START_BODY_FILE"' EXIT

start_computer_use() {
    local start_http

    start_http="$(
        curl --silent --show-error --max-time 5 \
            --request POST \
            --output "$START_BODY_FILE" \
            --write-out '%{http_code}' \
            "$START_URL" 2>/dev/null || true
    )"

    if [ "$start_http" = "200" ]; then
        log_info "computer-use start accepted (HTTP 200)"
        return 0
    fi

    log_warn "computer-use start request not ready yet (HTTP ${start_http:-000})"
    if [ -s "$START_BODY_FILE" ]; then
        sed -n '1,40p' "$START_BODY_FILE" >&2
    fi
    return 1
}

log_info "Starting computer-use: ${START_URL}"
start_computer_use || true

log_info "Waiting for computer-use readiness: ${STATUS_URL} (timeout=${DECK_SKILL_TEST_TIMEOUT_SEC}s, start-retry=${DECK_SKILL_TEST_START_RETRY_INTERVAL_SEC}s)"
last_start_retry_at=$SECONDS

while true; do
    HTTP_CODE="$(
        curl --silent --show-error --max-time 5 \
            --output "$LAST_BODY_FILE" \
            --write-out '%{http_code}' \
            "$STATUS_URL" 2>/dev/null || true
    )"

    if [ "$HTTP_CODE" = "200" ]; then
        if jq -e '.status == "active" or .status == "partial"' "$LAST_BODY_FILE" >/dev/null 2>&1; then
            READY_STATUS="$(jq -r '.status' "$LAST_BODY_FILE")"
            log_info "Computer-use is ready with status=${READY_STATUS}"
            jq -n \
                --arg status "ready" \
                --arg computerUseStatus "$READY_STATUS" \
                --arg url "$STATUS_URL" \
                '{status:$status, computerUseStatus:$computerUseStatus, url:$url}'
            exit 0
        fi
    fi

    if [ $((SECONDS - last_start_retry_at)) -ge "$DECK_SKILL_TEST_START_RETRY_INTERVAL_SEC" ]; then
        start_computer_use || true
        last_start_retry_at=$SECONDS
    fi

    if [ "$SECONDS" -ge "$DEADLINE" ]; then
        log_error "Timed out waiting for computer-use readiness"
        jq -n \
            --arg status "error" \
            --arg code "COMPUTERUSE_NOT_READY" \
            --arg url "$STATUS_URL" \
            --arg startUrl "$START_URL" \
            --arg httpCode "${HTTP_CODE:-000}" \
            --rawfile lastBody "$LAST_BODY_FILE" \
            --rawfile lastStartBody "$START_BODY_FILE" \
            '{status:$status, code:$code, url:$url, startUrl:$startUrl, httpCode:$httpCode, lastBody:$lastBody, lastStartBody:$lastStartBody}' >&2
        dump_container_logs "$DECK_SKILL_TEST_CONTAINER_NAME" 120
        exit 1
    fi

    sleep 2
done
