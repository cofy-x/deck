#!/bin/bash

if docker ps | grep -q "deck-desktop-sandbox-ai"; then
    docker stop deck-desktop-sandbox-ai
    docker rm deck-desktop-sandbox-ai
fi

ssh-keygen -R \[127.0.0.1\]:22220

docker run \
    --platform linux/amd64 \
    --name deck-desktop-sandbox-ai \
    -d \
    -p 5901:5901 \
    -p 6080:6080 \
    -p 2280:2280 \
    -p 22220:22220 \
    -p 22222:22222 \
    -e DISPLAY=:1 \
    -e VNC_PORT=5901 \
    -e NO_VNC_PORT=6080 \
    -e VNC_RESOLUTION=1280x720 \
    -e VNC_USER=deck \
    -e DECK_LOG_LEVEL=debug \
    ghcr.io/cofy-x/deck/desktop-sandbox-ai:latest

echo "Desktop sandbox AI deployed."

echo "Web Terminal: http://localhost:22222"
echo "noVNC:        http://localhost:6080"
echo "SSH:          ssh deck@localhost -p 22220"
echo "Daemon:       http://localhost:2280/version"