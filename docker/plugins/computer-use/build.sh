#!/bin/bash
# File: hack/computer-use/build.sh

set -e

# Resolve project root
REPO_ROOT=$(git rev-parse --show-toplevel)
cd "$REPO_ROOT"

# Align with Makefile directory structure
# Target is always linux_amd64 because this plugin runs inside the Linux Sandbox
TARGET_DIR="dist/linux_amd64"
mkdir -p "$TARGET_DIR"

# Check for skip environment variable
if [ -n "$SKIP_COMPUTER_USE_BUILD" ]; then
    echo "Skipping computer-use build per environment variable"
    exit 0
fi

BINARY_NAME="deck-computer-use-amd64"
CURRENT_ARCH=$(uname -m)

echo "--------------------------------------------------"
echo "Host Architecture: $CURRENT_ARCH"
echo "Target Architecture: linux/amd64"
echo "--------------------------------------------------"

# Check if we can do a native CGO build (only on Linux x86_64)
if [ "$(uname)" = "Linux" ] && [ "$CURRENT_ARCH" = "x86_64" ]; then
    echo "Performing native Linux/amd64 build..."
    
    # Ensure local CGO dependencies are checked (optional but recommended)
    # Note: Requires libx11-dev libxtst-dev libxext-dev installed on host
    CGO_ENABLED=1 GOOS=linux GOARCH=amd64 \
    go build -ldflags="-s -w" \
    -o "$TARGET_DIR/$BINARY_NAME" \
    ./packages/computer-use/cmd/plugin/main.go
    
else
    # Fallback to Docker for cross-compilation (e.g., on macOS)
    echo "Performing cross-platform build via Docker (linux/amd64)..."

    IMAGE_NAME="deck-computer-use-amd64:build"

    # Build the specialized builder image
    docker build \
        --platform linux/amd64 \
        -t "$IMAGE_NAME" \
        -f docker/plugins/computer-use/Dockerfile .

    # Run the container to extract the binary into the host's dist directory
    docker run --rm \
        --platform linux/amd64 \
        -v "$(pwd)/$TARGET_DIR:/dist" \
        "$IMAGE_NAME"
fi

# Final verification
if [ -f "$TARGET_DIR/$BINARY_NAME" ]; then
    echo "--------------------------------------------------"
    echo "Build Successful!"
    echo "Location: $TARGET_DIR/$BINARY_NAME"
    echo "Size: $(ls -lh $TARGET_DIR/$BINARY_NAME | awk '{print $5}')"
    echo "--------------------------------------------------"
else
    echo "Build failed: Binary not found."
    exit 1
fi