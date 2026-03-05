#!/usr/bin/env bash
set -euo pipefail

IMAGE="${IMAGE:-deck/runx-base-jdk21:0.0.1-aliyun-amd64}"
PLATFORM="${PLATFORM:-linux/amd64}"
CONTAINER_NAME="${CONTAINER_NAME:-runx-base-jdk21-test}"
HOST_PORT="${HOST_PORT:-2222}"
CONTAINER_PORT="${CONTAINER_PORT:-22}"
CLEANUP="${CLEANUP:-1}"

log() {
  printf '\n[%s] %s\n' "$(date '+%H:%M:%S')" "$*"
}

cleanup() {
  if [[ "${CLEANUP}" == "1" ]]; then
    docker rm -f "${CONTAINER_NAME}" >/dev/null 2>&1 || true
    log "Cleaned up container: ${CONTAINER_NAME}"
  fi
}

trap cleanup EXIT

log "Preparing container: ${CONTAINER_NAME}"
docker rm -f "${CONTAINER_NAME}" >/dev/null 2>&1 || true
docker run --platform="${PLATFORM}" -d --name "${CONTAINER_NAME}" -p "${HOST_PORT}:${CONTAINER_PORT}" "${IMAGE}" >/dev/null
sleep 2

log "Checking supervisord and sshd processes"
docker exec "${CONTAINER_NAME}" pgrep -af supervisord
docker exec "${CONTAINER_NAME}" pgrep -af sshd

log "Checking default user"
docker exec "${CONTAINER_NAME}" id admin

log "Checking runtimes"
docker exec "${CONTAINER_NAME}" java -version
docker exec "${CONTAINER_NAME}" python3 --version

log "Checking removed runtimes (node/go should not exist)"
if docker exec "${CONTAINER_NAME}" sh -lc 'node --version' >/dev/null 2>&1; then
  echo "Unexpected: node exists"
  exit 1
fi
if docker exec "${CONTAINER_NAME}" sh -lc 'go version' >/dev/null 2>&1; then
  echo "Unexpected: go exists"
  exit 1
fi
echo "node/go checks passed"

log "Checking image command"
docker inspect "${CONTAINER_NAME}" --format 'Entrypoint={{json .Config.Entrypoint}} Cmd={{json .Config.Cmd}}'

if command -v sshpass >/dev/null 2>&1; then
  log "Checking SSH login with admin/admin"
  sshpass -p admin ssh \
    -o StrictHostKeyChecking=no \
    -o UserKnownHostsFile=/dev/null \
    -p "${HOST_PORT}" admin@127.0.0.1 'id -un'
else
  log "sshpass not found, skip SSH password login check"
fi

log "All checks passed"
