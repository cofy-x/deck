#!/bin/bash

# Build the runtime base image
docker build --platform linux/amd64 -t deck/cli-runtime-base:latest -f docker/cli/runtime-base/Dockerfile .