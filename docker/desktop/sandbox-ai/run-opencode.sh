#!/usr/bin/env bash
set -euo pipefail

CONTAINER_NAME="${CONTAINER_NAME:-deck-desktop-sandbox-ai-remote}"
IMAGE_NAME="${IMAGE_NAME:-deck/desktop-sandbox-ai:latest}"

HOST_OPENCODE_PORT="${HOST_OPENCODE_PORT:-14096}"
HOST_VNC_PORT="${HOST_VNC_PORT:-15901}"
HOST_NOVNC_PORT="${HOST_NOVNC_PORT:-16080}"
HOST_DAEMON_PORT="${HOST_DAEMON_PORT:-12280}"
HOST_SSH_PORT="${HOST_SSH_PORT:-12220}"
HOST_WEB_TERMINAL_PORT="${HOST_WEB_TERMINAL_PORT:-12222}"

OPENCODE_SERVER_USERNAME="${OPENCODE_SERVER_USERNAME:-deck}"
OPENCODE_SERVER_PASSWORD="${OPENCODE_SERVER_PASSWORD:-deck}"
DECK_DAEMON_TOKEN="${DECK_DAEMON_TOKEN:-}"

detect_lan_ip() {
  # Prefer 192.168.x.x for quick REMOTE-mode testing in LAN.
  local candidates
  candidates="$(ifconfig 2>/dev/null | awk '/inet / {print $2}' | grep -vE '^(127\.|169\.254\.)' || true)"
  local preferred
  preferred="$(printf '%s\n' "$candidates" | grep -E '^192\.168\.' | head -n1 || true)"
  if [ -n "$preferred" ]; then
    echo "$preferred"
    return
  fi

  local fallback
  fallback="$(printf '%s\n' "$candidates" | head -n1 || true)"
  echo "$fallback"
}

LAN_IP="${LAN_IP:-$(detect_lan_ip)}"

if docker ps -a --format '{{.Names}}' | grep -qx "$CONTAINER_NAME"; then
  docker rm -f "$CONTAINER_NAME" >/dev/null
fi

ssh-keygen -R "[127.0.0.1]:${HOST_SSH_PORT}" >/dev/null 2>&1 || true
if [ -n "${LAN_IP}" ]; then
  ssh-keygen -R "[${LAN_IP}]:${HOST_SSH_PORT}" >/dev/null 2>&1 || true
fi

docker_args=(
  --platform linux/amd64
  --name "$CONTAINER_NAME"
  -d
  -p "${HOST_OPENCODE_PORT}:4096"
  -p "${HOST_VNC_PORT}:5901"
  -p "${HOST_NOVNC_PORT}:6080"
  -p "${HOST_DAEMON_PORT}:2280"
  -p "${HOST_SSH_PORT}:22220"
  -p "${HOST_WEB_TERMINAL_PORT}:22222"
  -e DISPLAY=:1
  -e VNC_PORT=5901
  -e NO_VNC_PORT=6080
  -e VNC_RESOLUTION=1280x720
  -e VNC_USER=deck
  -e DECK_LOG_LEVEL=debug
  -e "OPENCODE_SERVER_USERNAME=${OPENCODE_SERVER_USERNAME}"
  -e "OPENCODE_SERVER_PASSWORD=${OPENCODE_SERVER_PASSWORD}"
)

if [ -n "${DECK_DAEMON_TOKEN}" ]; then
  docker_args+=(-e "DECK_DAEMON_TOKEN=${DECK_DAEMON_TOKEN}")
fi

docker run \
  "${docker_args[@]}" \
  "$IMAGE_NAME" \
  opencode serve --hostname 0.0.0.0 --port 4096 --print-logs --log-level DEBUG

echo "Desktop sandbox AI deployed."
echo
echo "Local Endpoints:"
echo "Web Terminal: http://localhost:${HOST_WEB_TERMINAL_PORT}"
echo "noVNC:        http://localhost:${HOST_NOVNC_PORT}"
echo "SSH:          ssh deck@localhost -p ${HOST_SSH_PORT}"
echo "Daemon:       http://localhost:${HOST_DAEMON_PORT}/version"
echo "Opencode:     http://localhost:${HOST_OPENCODE_PORT}"
echo

if [ -n "${LAN_IP}" ]; then
  echo "REMOTE Test Endpoints (LAN ${LAN_IP}):"
  echo "Web Terminal: http://${LAN_IP}:${HOST_WEB_TERMINAL_PORT}"
  echo "noVNC:        http://${LAN_IP}:${HOST_NOVNC_PORT}"
  echo "SSH:          ssh deck@${LAN_IP} -p ${HOST_SSH_PORT}"
  echo "Daemon:       http://${LAN_IP}:${HOST_DAEMON_PORT}/version"
  echo "Opencode:     http://${LAN_IP}:${HOST_OPENCODE_PORT}"
  echo
  echo "Deck Client Remote Profile (recommended):"
  echo "  OpenCode Base URL: http://${LAN_IP}:${HOST_OPENCODE_PORT}"
  echo "  Daemon Base URL:   http://${LAN_IP}:${HOST_DAEMON_PORT}"
  echo "  noVNC URL:         http://${LAN_IP}:${HOST_NOVNC_PORT}/vnc.html?autoconnect=true&resize=scale"
  echo "  Web Terminal URL:  http://${LAN_IP}:${HOST_WEB_TERMINAL_PORT}"
  echo "  OpenCode Basic:    ${OPENCODE_SERVER_USERNAME} / ${OPENCODE_SERVER_PASSWORD}"
  if [ -n "${DECK_DAEMON_TOKEN}" ]; then
    echo "  Daemon Token:      ${DECK_DAEMON_TOKEN}"
  else
    echo "  Daemon Token:      (not set)"
  fi
else
  echo "LAN IP not detected. Set manually and rerun:"
  echo "  LAN_IP=192.168.x.x bash docker/desktop/sandbox-ai/run-opencode.sh"
fi
