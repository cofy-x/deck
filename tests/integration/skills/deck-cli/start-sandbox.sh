#!/usr/bin/env bash

# Start dedicated desktop sandbox instance for deck-cli skill integration tests.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../../../.." && pwd)"
source "${SCRIPT_DIR}/lib/helpers.sh"

: "${DECK_SKILL_TEST_CONTAINER_NAME:=deck-desktop-sandbox-ai-skill-test}"
: "${DECK_SKILL_TEST_IMAGE:=deck/desktop-sandbox-ai:latest}"

: "${HOST_DAEMON_PORT:=13280}"
: "${HOST_OPENCODE_PORT:=15496}"
: "${HOST_VNC_PORT:=16911}"
: "${HOST_NOVNC_PORT:=17090}"
: "${HOST_SSH_PORT:=13230}"
: "${HOST_WEB_TERMINAL_PORT:=13232}"

RUN_OPENCODE_SCRIPT="${REPO_ROOT}/docker/desktop/sandbox-ai/run-opencode.sh"

if [ ! -f "$RUN_OPENCODE_SCRIPT" ]; then
    log_error "Missing script: $RUN_OPENCODE_SCRIPT"
    exit 1
fi

log_info "Starting sandbox container: ${DECK_SKILL_TEST_CONTAINER_NAME}"
log_info "Using image: ${DECK_SKILL_TEST_IMAGE}"
log_info "Ports: daemon=${HOST_DAEMON_PORT}, opencode=${HOST_OPENCODE_PORT}, vnc=${HOST_VNC_PORT}, novnc=${HOST_NOVNC_PORT}, ssh=${HOST_SSH_PORT}, web-terminal=${HOST_WEB_TERMINAL_PORT}"

CONTAINER_NAME="${DECK_SKILL_TEST_CONTAINER_NAME}" \
IMAGE_NAME="${DECK_SKILL_TEST_IMAGE}" \
HOST_DAEMON_PORT="${HOST_DAEMON_PORT}" \
HOST_OPENCODE_PORT="${HOST_OPENCODE_PORT}" \
HOST_VNC_PORT="${HOST_VNC_PORT}" \
HOST_NOVNC_PORT="${HOST_NOVNC_PORT}" \
HOST_SSH_PORT="${HOST_SSH_PORT}" \
HOST_WEB_TERMINAL_PORT="${HOST_WEB_TERMINAL_PORT}" \
bash "$RUN_OPENCODE_SCRIPT"

log_info "Sandbox start command completed"
