#!/usr/bin/env bash
set -euo pipefail

IMAGE="${IMAGE:-deck/runx-base-jdk21:0.0.1-aliyun-amd64}"
PLATFORM="${PLATFORM:-linux/amd64}"
CONTAINER_NAME="${CONTAINER_NAME:-runx-base-jdk21}"
HOST_PORT="${HOST_PORT:-2222}"
CONTAINER_PORT="${CONTAINER_PORT:-22}"
CLEAN_KNOWN_HOSTS="${CLEAN_KNOWN_HOSTS:-1}"

echo "Starting ${CONTAINER_NAME} from ${IMAGE} (${PLATFORM}) ..."

if [[ "${CLEAN_KNOWN_HOSTS}" == "1" ]] && command -v ssh-keygen >/dev/null 2>&1; then
  ssh-keygen -R "[127.0.0.1]:${HOST_PORT}" >/dev/null 2>&1 || true
fi

docker rm -f "${CONTAINER_NAME}" >/dev/null 2>&1 || true
docker run --platform="${PLATFORM}" -d \
  --name "${CONTAINER_NAME}" \
  -p "${HOST_PORT}:${CONTAINER_PORT}" \
  "${IMAGE}" >/dev/null

cat <<EOF
Container is up.

Usage:
  SSH login:
    ssh admin@127.0.0.1 -p ${HOST_PORT}
    password: admin

  Open zsh as admin:
    docker exec -it --user admin ${CONTAINER_NAME} zsh

  Check logs:
    docker logs -f ${CONTAINER_NAME}

  Stop and remove:
    docker rm -f ${CONTAINER_NAME}
EOF
