#!/bin/bash

# Configuration
IMAGE_NAME="deck/desktop-runtime-base:24.04-aliyun-amd64"
CONTAINER_NAME="deck-desktop-runtime-base"
VNC_PORT=5901
NO_VNC_PORT=6080
SSH_PORT=22220
RESOLUTION="1280x720"

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

printf "${BLUE}==> Cleaning up old containers...${NC}"
docker rm -f $CONTAINER_NAME 2>/dev/null

printf "${BLUE}==> Starting $IMAGE_NAME...${NC}"

# Core Run Command
docker run -d \
  --platform linux/amd64 \
  --name $CONTAINER_NAME \
  -p $VNC_PORT:5901 \
  -p $NO_VNC_PORT:6080 \
  -p $SSH_PORT:22 \
  --env VNC_RESOLUTION=$RESOLUTION \
  --shm-size=2g \
  --security-opt seccomp=unconfined \
  $IMAGE_NAME

# Wait for services to initialize
sleep 2

printf "${GREEN}Deployment Successful!${NC}\n"

printf "1. ${BLUE}Web Access (NoVNC): http://localhost:$NO_VNC_PORT${NC}\n"
printf "2. ${BLUE}VNC Client: localhost:$VNC_PORT (No password)${NC}\n"
printf "3. ${BLUE}SSH Client: localhost:$SSH_PORT (Password: deck)${NC}\n"
printf "4. ${BLUE}View logs: docker logs -f $CONTAINER_NAME${NC}\n"
printf "5. ${BLUE}Enter shell: docker exec -it -u deck $CONTAINER_NAME /bin/bash${NC}\n"