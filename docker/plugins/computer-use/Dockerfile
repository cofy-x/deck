# File: docker/plugins/computer-use/Dockerfile  
# Dockerfile for building the computer-use plugin for linux/amd64

# Use golang image directly which should handle cross-compilation better
FROM golang:1.25.5 AS builder

# Install CGO dependencies for X11/GUI operations
RUN apt-get update && apt-get install -y \
    libx11-dev \
    libxtst-dev \
    libxext-dev \
    gcc \
    pkg-config \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy workspace files
COPY go.work go.work.sum* ./
COPY ./packages/computer-use ./packages/computer-use
COPY ./packages/core-go ./packages/core-go

# Drop unused packages from workspace
RUN go work edit \
    -dropuse ./apps/cli \
    -dropuse ./packages/daemon \
    -dropuse ./packages/client-daemon-go

# Build the computer-use plugin binary for linux/amd64
RUN CGO_ENABLED=1 GOOS=linux GOARCH=amd64 \
    go build -ldflags="-s -w" \
    -o /app/deck-computer-use \
    ./packages/computer-use/cmd/plugin/main.go && \
    chmod +x /app/deck-computer-use

# Runtime stage - minimal image for extraction
FROM scratch AS export
COPY --from=builder /app/deck-computer-use /deck-computer-use-amd64

# Define the volume for binary extraction
VOLUME ["/dist"]

# Default: use builder stage for extraction
FROM builder AS default
ENTRYPOINT ["cp", "/app/deck-computer-use", "/dist/deck-computer-use-amd64"]
