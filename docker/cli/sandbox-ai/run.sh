#!/bin/bash

CONTAINER_NAME="deck-cli-sandbox-ai"
SSH_PORT=12220
TOOLBOX_PORT=12280
WEB_TERMINAL_PORT=12222

docker rm -f $CONTAINER_NAME 2>/dev/null

# Run the sandbox ai image
docker run -d \
    --platform linux/amd64 \
    --name $CONTAINER_NAME \
    -p $SSH_PORT:22220 \
    -p $TOOLBOX_PORT:2280 \
    -p $WEB_TERMINAL_PORT:22222 \
    -e DECK_LOG_LEVEL=debug \
    deck/cli-sandbox-ai:latest

echo "CLI Sandbox AI deployed."
echo "Web Terminal: http://localhost:$WEB_TERMINAL_PORT"
echo "SSH:          ssh deck@localhost -p $SSH_PORT"
echo "Daemon:       http://localhost:$TOOLBOX_PORT/version"