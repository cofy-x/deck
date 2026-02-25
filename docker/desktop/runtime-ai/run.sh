#!/bin/bash

# --- Configuration ---
IMAGE_NAME="deck/desktop-runtime-ai:latest"
CONTAINER_NAME="deck-desktop-runtime-ai"
VNC_PORT=5901
NO_VNC_PORT=6080
SSH_PORT=22220
RESOLUTION="1280x720"

# --- UI Colors ---
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m'

# --- 1. Cleanup ---
printf "${BLUE}==> Stopping and removing existing dev container...${NC}\n"
docker rm -f $CONTAINER_NAME 2>/dev/null

# --- 2. Execution ---
printf "${BLUE}==> Launching %s on linux/amd64...${NC}\n" "$IMAGE_NAME"

# Note: We include both seccomp and apparmor unconfined for maximum Chrome/Go compatibility
docker run -d \
  --platform linux/amd64 \
  --name $CONTAINER_NAME \
  -p $VNC_PORT:5901 \
  -p $NO_VNC_PORT:6080 \
  -p $SSH_PORT:22 \
  --env VNC_RESOLUTION=$RESOLUTION \
  --shm-size=2g \
  --security-opt seccomp=unconfined \
  --security-opt apparmor=unconfined \
  -v "$(pwd)/data/home:/home/deck/Downloads" \
  $IMAGE_NAME

# Wait for Xvfb and Supervisord to initialize
sleep 2

# --- 3. Summary ---
printf "%s\n" "-------------------------------------------------------"
printf "${GREEN}Dev Environment is Live!${NC}\n"
printf "Architecture:  ${YELLOW}linux/amd64 (Emulated)${NC}\n"
printf "Web UI:        ${BLUE}http://localhost:%s${NC}\n" "$NO_VNC_PORT"
printf "VNC Client:    ${BLUE}localhost:%s${NC}\n" "$VNC_PORT"
printf "SSH Client:    ${BLUE}localhost:%s${NC}\n" "$SSH_PORT"
printf "%s\n" "-------------------------------------------------------"
printf "${YELLOW}Installed Toolchains:${NC}\n"
printf " - Node.js:    v24.13.0 (NVM)\n"
printf " - Go:         1.25.6\n"
printf " - Python:     3.10.x (Ubuntu Native)\n"
printf " - Shell:      Zsh + Oh-My-Zsh\n"
printf "%s\n" "-------------------------------------------------------"
printf "View Logs:     docker logs -f %s\n" "$CONTAINER_NAME"
printf "Enter Shell:   docker exec -it -u deck %s /usr/bin/zsh\n" "$CONTAINER_NAME"
printf "%s\n" "-------------------------------------------------------"
printf "Gemini:        docker exec %s gemini --version\n" "$CONTAINER_NAME"
printf "OpenCode:      docker exec %s opencode --version\n" "$CONTAINER_NAME"
printf "Codex:         docker exec %s codex --version\n" "$CONTAINER_NAME"
printf "Claude:        docker exec %s claude --version\n" "$CONTAINER_NAME"
printf "%s\n" "-------------------------------------------------------"

# Architecture Warning
printf "${YELLOW}Reminder:${NC} Under QEMU emulation (amd64 on Mac), Chrome may show\n"
printf "sandbox warnings. These are safe to ignore in this dev container.\n"
printf "%s\n" "-------------------------------------------------------"