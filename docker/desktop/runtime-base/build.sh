#!/bin/bash

# ==============================================================================
# Deck Project - Docker Build Script
# Description: Builds the base desktop environment for the Deck platform.
# Usage: bash ./build.sh [mirror_source] [target_arch]
# Example: bash ./build.sh aliyun amd64
# ==============================================================================

# Project Settings
PROJECT_NAME="deck"
BASE_NAME="desktop-runtime-base"
VERSION="24.04"

# Arguments
MIRROR_SOURCE=${1:-"aliyun"}
TARGET_ARCH=${2:-"amd64"}

# Final Image Tagging
# Format: deck/desktop-runtime-base:24.04-aliyun-amd64
FULL_IMAGE_NAME="${PROJECT_NAME}/${BASE_NAME}"
TAG="${VERSION}-${MIRROR_SOURCE}-${TARGET_ARCH}"

echo "======================================================="
echo "  DECK BUILD SYSTEM"
echo "======================================================="
echo "  Target Image : ${FULL_IMAGE_NAME}:${TAG}"
echo "  Mirror       : ${MIRROR_SOURCE}"
echo "  Platform     : linux/${TARGET_ARCH}"
echo "-------------------------------------------------------"

# Build Command
docker build \
    --platform "linux/${TARGET_ARCH}" \
    --build-arg MIRROR_SOURCE="${MIRROR_SOURCE}" \
    --build-arg TARGETARCH="${TARGET_ARCH}" \
    -t "${FULL_IMAGE_NAME}:${TAG}" \
    --load .

if [ $? -eq 0 ]; then
    echo "-------------------------------------------------------"
    echo "BUILD COMPLETE"
    echo "Local Image: ${FULL_IMAGE_NAME}:${TAG}"
else
    echo "BUILD FAILED"
    exit 1
fi