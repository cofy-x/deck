#!/bin/bash

# Build the runtime ai image
docker build --platform linux/amd64 -t deck/cli-runtime-ai:latest -f docker/cli/runtime-ai/Dockerfile .