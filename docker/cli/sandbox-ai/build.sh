#!/bin/bash

# Build the runtime ai image
docker build --platform linux/amd64 -t deck/cli-sandbox-ai:latest -f docker/cli/sandbox-ai/Dockerfile .