#!/bin/bash

docker build \
    --platform linux/amd64 \
    -t deck/desktop-sandbox-ai:latest \
    -f docker/desktop/sandbox-ai/Dockerfile .