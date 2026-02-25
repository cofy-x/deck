#!/bin/bash

docker build \
    --platform linux/amd64 \
    -t deck/desktop-runtime-ai:latest \
    -f Dockerfile .