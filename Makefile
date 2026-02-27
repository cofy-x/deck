# ==============================================================================
# Deck Monorepo Makefile
# ==============================================================================

# Variables
PNPM := pnpm
NODE := node
GO   := go
DEPLOY_LOCAL := deploy/local
DAEMON_DIR := packages/daemon
SDK_GO_ROOT := packages/client-daemon-go
SDK_GO_OUT  := $(SDK_GO_ROOT)/daemon
SWAGGER_JSON_PATH := $(DAEMON_DIR)/pkg/toolbox/docs/swagger.json
OPENAPI_GENERATOR_IMAGE := openapitools/openapi-generator-cli:v7.19.0

# Pilot environment files (override via `make target KEY=value`)
PILOT_LOCAL_ENV_FILE ?= .vscode/pilot.local.env
PILOT_LOCAL_ENV_EXAMPLE_FILE ?= .vscode/pilot.local.env.example
PILOT_BRIDGE_ENV_FILE ?= apps/pilot/bridge/.env
PILOT_BRIDGE_ENV_EXAMPLE_FILE ?= apps/pilot/bridge/.env.example

# Go Build Flags & Environment
# Default to host OS/Arch, but allow overrides (e.g., make build-go GOOS=linux)
GOOS        ?= $(shell go env GOOS)
GOARCH      ?= $(shell go env GOARCH)
CGO_ENABLED ?= 0

# Extract version from package.json
VERSION := $(shell node -p "require('./package.json').version")

# Build metadata
BUILD_TIME := $(shell date -u '+%Y-%m-%d_%H:%M:%S')
GIT_COMMIT := $(shell git rev-parse --short HEAD 2>/dev/null || echo "unknown")

# Output Directory Structure: dist/$(GOOS)_$(GOARCH)/
BIN_DIR     := dist
OUTPUT_DIR  := $(BIN_DIR)/$(GOOS)_$(GOARCH)

# Base linker flags (strip symbols and reduce binary size)
BASE_LDFLAGS := -s -w

# Application-specific linker flags with version injection
DAEMON_LDFLAGS := -ldflags="$(BASE_LDFLAGS) -X 'github.com/cofy-x/deck/packages/daemon/internal.Version=v$(VERSION)'"
CLI_LDFLAGS    := -ldflags="$(BASE_LDFLAGS) -X 'github.com/cofy-x/deck/apps/cli/internal.Version=v$(VERSION)'"

# Go Application Entrypoints
DAEMON_MAIN := packages/daemon/cmd/daemon/main.go
CLI_MAIN    := apps/cli/cmd/cli/main.go

# Binary names with optional platform suffix
PROXY_BIN  := proxy
DAEMON_BIN := daemon
CLI_BIN    := cli

.PHONY: all help install build test lint clean \
        install-ts build-ts build-landing build-landing-image \
        install-go download-xterm build-go build-linux build-darwin build-darwin-amd64 \
		build-windows build-all-platforms fmt-go lint-go test-go \
		docker-dev-up docker-dev-down \
		run-api run-dashboard run-landing \
		pilot-build pilot-build-host pilot-build-server pilot-build-bridge \
		pilot-test pilot-test-host pilot-test-server pilot-test-bridge \
		pilot-env-init pilot-bridge-env-init \
		pilot-run-server pilot-run-bridge pilot-run-host-external pilot-status \
		build-cli build-cli-linux build-cli-darwin-arm64 dev-cli-mcp

# ------------------------------------------------------------------------------
# Default Target & Help
# ------------------------------------------------------------------------------

help: ## Show this help message
	@echo "Usage: make [target]"
	@echo ""
	@echo "Targets:"
	@grep -E '^[a-zA-Z0-9_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-20s\033[0m %s\n", $$1, $$2}'

all: install build ## Install dependencies and build everything

# ------------------------------------------------------------------------------
# Global Lifecycle
# ------------------------------------------------------------------------------

install: install-ts install-go ## Install all dependencies (Node.js & Go)

build: build-ts build-go ## Build all applications

test: test-ts test-go ## Run all tests

lint: lint-ts lint-go ## Run linters

clean: ## Clean up build artifacts
	@echo "Cleaning up..."
	@rm -rf $(BIN_DIR)
	@rm -rf $(DAEMON_EMBED_DIR)
	@rm -rf apps/*/dist
	@rm -rf packages/*/dist
	@rm -rf packages/*/tsconfig.tsbuildinfo
	@echo "Clean complete."

# ------------------------------------------------------------------------------
# TypeScript / Node.js Tasks
# ------------------------------------------------------------------------------

install-ts: ## Install Node.js dependencies
	@echo "Installing Node.js dependencies..."
	@$(PNPM) install

build-ts: ## Build all TypeScript projects
	@echo "Building TypeScript projects..."
	@$(PNPM) run build

build-landing: ## Build landing web app
	@$(PNPM) --filter @cofy-x/deck-landing run build

build-landing-image: ## Build landing Docker image
	@docker build --platform linux/amd64 -t deck/landing:latest -f docker/landing/Dockerfile .

test-ts: ## Run Vitest
	@$(PNPM) run test

lint-ts: ## Run ESLint
	@$(PNPM) run lint

gen-daemon-swagger: ## Generate Swagger documentation for Daemon Toolbox API
	@echo "Generating Daemon Toolbox API Swagger docs..."
	@cd $(DAEMON_DIR) && swag fmt && swag init \
		--parseDependency \
		--parseInternal \
		--parseDepth 10 \
		--useStructName \
		-g pkg/toolbox/toolbox.go \
		-o pkg/toolbox/docs
	@echo "Daemon Toolbox API Swagger docs generated."

gen-swagger: gen-daemon-swagger ## Generate all Swagger documentation
	@echo "All Swagger docs generated."

gen-daemon-sdk-go: gen-daemon-swagger ## Generate Go SDK for Daemon via Docker
	@echo "Generating Daemon Go SDK via Docker..."
	@mkdir -p $(SDK_GO_OUT)
	docker run --rm -v $(PWD):/local $(OPENAPI_GENERATOR_IMAGE) generate \
		-i /local/$(SWAGGER_JSON_PATH) \
		-g go \
		-o /local/$(SDK_GO_OUT) \
		-c /local/$(SDK_GO_ROOT)/openapi-config.yaml
	@echo "Go SDK generated at $(SDK_GO_OUT)"

gen-client: ## Auto-generate TypeScript clients from Go APIs
	@$(NODE) scripts/generate_client.js

gen-sdk: gen-client gen-daemon-sdk-go ## Generate all SDKs (TS and Go)

# ------------------------------------------------------------------------------
# Go Tasks
# ------------------------------------------------------------------------------

install-go: download-xterm ## Download Go module dependencies
	@echo "Downloading Go modules..."
	@go list -f '{{.Dir}}' -m | xargs -I {} sh -c 'cd {} && $(GO) mod download'
	@echo "Go modules downloaded."

download-xterm: ## Download xterm.js dependencies for daemon terminal
	@echo "Downloading xterm.js files..."
	@GOOS= GOARCH= $(GO) run packages/daemon/tools/xterm.go
	@echo "xterm.js dependencies downloaded."

# --- Core Build Targets ---

build-computer-use: ## Build the computer-use plugin binary (Linux/AMD64)
	@bash docker/plugins/computer-use/build.sh

build-daemon: download-xterm ## Build Daemon binary for the current host (or specified GOOS)
	@mkdir -p $(OUTPUT_DIR)
	@echo "Building Daemon binary for $(GOOS)/$(GOARCH)..."
	@CGO_ENABLED=$(CGO_ENABLED) GOOS=$(GOOS) GOARCH=$(GOARCH) $(GO) build $(DAEMON_LDFLAGS) -o $(OUTPUT_DIR)/$(DAEMON_BIN) $(DAEMON_MAIN)

build-daemon-linux: ## Build Daemon for Linux/AMD64
	@$(MAKE) build-daemon GOOS=linux GOARCH=amd64 CGO_ENABLED=0

build-cli: ## Build CLI binary
	@mkdir -p $(OUTPUT_DIR)
	@echo "Building CLI binary for $(GOOS)/$(GOARCH)..."
	@CGO_ENABLED=$(CGO_ENABLED) GOOS=$(GOOS) GOARCH=$(GOARCH) $(GO) build $(CLI_LDFLAGS) -o $(OUTPUT_DIR)/$(CLI_BIN) $(CLI_MAIN)

build-cli-linux: ## Build CLI for Linux/AMD64
	@$(MAKE) build-cli GOOS=linux GOARCH=amd64 CGO_ENABLED=0

build-cli-darwin-arm64: ## Build CLI for macOS/ARM64 (Apple Silicon)
	@$(MAKE) build-cli GOOS=darwin GOARCH=arm64

dev-cli-mcp: build-cli-darwin-arm64 ## Build and test CLI with MCP Inspector
	@echo "Starting MCP Inspector..."
	@pnpm dlx @modelcontextprotocol/inspector ./dist/darwin_arm64/cli mcp serve

build-go: build-cli ## Build all Go binaries
	@echo "Build complete. Binaries in $(OUTPUT_DIR)/"


# --- Platform Specific Shortcuts ---
build-linux: ## Build Linux/AMD64 binaries (optimized for Docker)
	@$(MAKE) build-go GOOS=linux GOARCH=amd64 CGO_ENABLED=0
	@$(MAKE) build-computer-use

build-darwin: ## Build macOS/ARM64 binaries (for Apple Silicon)
	@$(MAKE) build-go GOOS=darwin GOARCH=arm64

build-darwin-amd64: ## Build macOS/AMD64 binaries (for Intel Macs)
	@$(MAKE) build-go GOOS=darwin GOARCH=amd64

build-windows: ## Build Windows/AMD64 binaries
	@$(MAKE) build-go GOOS=windows GOARCH=amd64

build-all-platforms: ## Build binaries for all common platforms
	@echo "Building for all platforms..."
	@$(MAKE) build-linux
	@$(MAKE) build-darwin
	@$(MAKE) build-darwin-amd64
	@$(MAKE) build-windows
	@echo "All platform builds complete. Check $(BIN_DIR)/ for outputs."

test-go: ## Run Go tests
	@echo "Running Go tests..."
	@go list -f '{{.Dir}}' -m | xargs -I {} sh -c 'cd {} && $(GO) test ./...'

fmt-go: ## Format Go code
	@echo "Formatting Go code..."
	@go list -f '{{.Dir}}' -m | xargs -I {} sh -c 'cd {} && $(GO) fmt ./...'

lint-go: ## Run golangci-lint
	@if command -v golangci-lint >/dev/null; then \
		echo "Running golangci-lint..."; \
		go list -f '{{.Dir}}' -m | xargs -I {} sh -c 'cd {} && golangci-lint run ./...'; \
	else \
		echo "golangci-lint not found. Skipping."; \
	fi

# ------------------------------------------------------------------------------
# Docker Tasks
# ------------------------------------------------------------------------------

docker-dev-up: ## Start the dev environment
	docker-compose -p deck -f $(DEPLOY_LOCAL)/docker-compose.yaml up -d
	@echo "Waiting for Redis..."
	@sleep 2
	@echo "Dev Environment Started (Redis, DB)."

docker-dev-down: ## Stop the dev environment
	docker-compose -p deck -f $(DEPLOY_LOCAL)/docker-compose.yaml down --remove-orphans
	@echo "Proxy Dev Environment Stopped."


# --- Hack Docker Desktop Build ---

build-desktop-runtime-base: ## Build the desktop runtime base image
	@cd docker/desktop/runtime-base && bash build.sh

run-desktop-runtime-base: build-desktop-runtime-base ## Run the desktop runtime base image
	@cd docker/desktop/runtime-base && bash run.sh

build-desktop-runtime-dev: build-desktop-runtime-base ## Build the desktop runtime dev image
	@cd docker/desktop/runtime-dev && bash build.sh

run-desktop-runtime-dev: build-desktop-runtime-dev ## Run the desktop runtime dev image
	@cd docker/desktop/runtime-dev && bash run.sh

build-desktop-runtime-ai: build-desktop-runtime-dev ## Build the desktop runtime ai image
	@cd docker/desktop/runtime-ai && bash build.sh

run-desktop-runtime-ai: build-desktop-runtime-ai ## Run the desktop runtime ai image
	@cd docker/desktop/runtime-ai && bash run.sh

build-desktop-sandbox-ai: build-desktop-runtime-ai build-computer-use build-daemon-linux build-cli-linux ## Build the desktop sandbox ai image
	@bash docker/desktop/sandbox-ai/build.sh

run-desktop-sandbox-ai: build-desktop-sandbox-ai ## Run the desktop sandbox ai image
	@cd docker/desktop/sandbox-ai && bash run.sh


# --- Hack Docker CLI Build ---

build-cli-runtime-base: ## Build the cli runtime base image
	@bash docker/cli/runtime-base/build.sh

build-cli-runtime-ai: build-cli-runtime-base ## Build the cli runtime ai image
	@bash docker/cli/runtime-ai/build.sh

build-cli-sandbox-ai: build-cli-runtime-ai build-daemon-linux build-cli-linux ## Build the cli sandbox ai image
	@bash docker/cli/sandbox-ai/build.sh

run-cli-sandbox-ai: build-cli-sandbox-ai ## Run the cli sandbox ai image
	@cd docker/cli/sandbox-ai && bash run.sh


# ------------------------------------------------------------------------------
# Run Tasks
# ------------------------------------------------------------------------------

pilot-build: pilot-build-host pilot-build-server pilot-build-bridge ## Build pilot host/server/bridge (TypeScript)

pilot-build-host: ## Build pilot-host only
	@$(PNPM) --filter @cofy-x/deck-pilot-host run build:tsc

pilot-build-server: ## Build pilot-server only
	@$(PNPM) --filter @cofy-x/deck-pilot-server run build:tsc

pilot-build-bridge: ## Build pilot-bridge only
	@$(PNPM) --filter @cofy-x/deck-pilot-bridge run build:tsc

pilot-test: ## Run pilot host/server/bridge tests
	@$(MAKE) pilot-test-host
	@$(MAKE) pilot-test-server
	@$(MAKE) pilot-test-bridge

pilot-test-host: ## Run pilot-host tests
	@$(PNPM) --filter @cofy-x/deck-pilot-host run test

pilot-test-server: ## Run pilot-server tests
	@$(PNPM) --filter @cofy-x/deck-pilot-server run test

pilot-test-bridge: ## Run pilot-bridge tests
	@$(PNPM) --filter @cofy-x/deck-pilot-bridge run test

pilot-env-init: ## Ensure .vscode/pilot.local.env exists (copy from example if missing)
	@if [ ! -f "$(PILOT_LOCAL_ENV_FILE)" ]; then \
		if [ ! -f "$(PILOT_LOCAL_ENV_EXAMPLE_FILE)" ]; then \
			echo "Missing $(PILOT_LOCAL_ENV_EXAMPLE_FILE)."; \
			exit 1; \
		fi; \
		cp "$(PILOT_LOCAL_ENV_EXAMPLE_FILE)" "$(PILOT_LOCAL_ENV_FILE)"; \
		echo "Created $(PILOT_LOCAL_ENV_FILE) from example."; \
	fi

pilot-bridge-env-init: ## Ensure apps/pilot/bridge/.env exists (copy from example if missing)
	@if [ ! -f "$(PILOT_BRIDGE_ENV_FILE)" ]; then \
		if [ ! -f "$(PILOT_BRIDGE_ENV_EXAMPLE_FILE)" ]; then \
			echo "Missing $(PILOT_BRIDGE_ENV_EXAMPLE_FILE)."; \
			exit 1; \
		fi; \
		cp "$(PILOT_BRIDGE_ENV_EXAMPLE_FILE)" "$(PILOT_BRIDGE_ENV_FILE)"; \
		echo "Created $(PILOT_BRIDGE_ENV_FILE) from example."; \
	fi

pilot-run-server: pilot-build-server pilot-env-init ## Run pilot-server using .vscode/pilot.local.env
	@set -a; \
	. "$(PILOT_LOCAL_ENV_FILE)"; \
	set +a; \
	$(PNPM) --filter @cofy-x/deck-pilot-server run start

pilot-run-bridge: pilot-build-bridge pilot-bridge-env-init ## Run pilot-bridge using apps/pilot/bridge/.env
	@$(PNPM) --filter @cofy-x/deck-pilot-bridge run start

pilot-run-host-external: pilot-build pilot-env-init ## Run pilot-host using .vscode/pilot.local.env
	@set -a; \
	. "$(PILOT_LOCAL_ENV_FILE)"; \
	set +a; \
	$(PNPM) --filter @cofy-x/deck-pilot-host run start -- start

pilot-status: pilot-build-host pilot-env-init ## Check health from .vscode/pilot.local.env
	@set -a; \
	. "$(PILOT_LOCAL_ENV_FILE)"; \
	set +a; \
	pilot_host="$${PILOT_HOST:-127.0.0.1}"; \
	$(PNPM) --filter @cofy-x/deck-pilot-host run start -- \
		status \
		--pilot-url http://$${pilot_host}:$${PILOT_PORT:-8787} \
		--opencode-url $${PILOT_OPENCODE_URL:-http://127.0.0.1:4096} \
		--bridge-url http://$${pilot_host}:$${BRIDGE_HEALTH_PORT:-3005}

run-api: ## Run NestJS API in dev mode
	@cp apps/api/.env.example apps/api/.env
	@$(PNPM) --filter @cofy-x/deck-api run db:push
	@$(PNPM) --filter @cofy-x/deck-api run start:dev

run-dashboard: ## Run React Dashboard in dev mode
	@$(PNPM) --filter @cofy-x/deck-dashboard run dev

run-landing: ## Run React Landing in dev mode
	@$(PNPM) --filter @cofy-x/deck-landing run dev


# ------------------------------------------------------------------------------
# Python Tasks
# ------------------------------------------------------------------------------

dev-py:
	uv sync --all-packages
	uv run --package server-py python apps/server-py/hello.py
