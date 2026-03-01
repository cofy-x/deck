# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project follows [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.0.1-alpha.3.4] - 2026-03-02

### Added

- Added `desktop-runtime-dev` Chrome configuration assets and startup hooks to enforce trusted desktop launcher metadata in XFCE/noVNC sessions.
- Added `docker/desktop/runtime-dev/README.md` to document Chrome launcher trust/keyring handling, verification commands, and troubleshooting.

### Changed

- Updated desktop sandbox startup logic in `apps/client` to recreate existing containers when the requested image ID changes, even if the tag string is unchanged.
- Updated `desktop-runtime-ai` default toolset to OpenCode-only, with Claude Code / Gemini / Codex moved out of the default layer.
- Refactored `packages/computer-use` process startup to extract syscall attribute and privilege-drop setup into `processSysProcAttr` without changing runtime behavior.
- Updated desktop runtime documentation to align image-layer responsibilities (`runtime-dev` launcher handling, `runtime-ai` OpenCode-first scope).

### Fixed

- Fixed repeated `Untrusted application launcher` prompts when clicking the desktop Google Chrome icon in XFCE/noVNC by applying launcher trust metadata and checksum repair at startup.
- Fixed Chrome keyring/password-store interruptions in containerized desktop sessions by combining `--password-store=basic` launcher defaults with managed Chrome password-manager policies.

## [0.0.1-alpha.3.3] - 2026-03-01

### Added

- Enhanced client log viewer with category filters and per-session tracing for easier debugging.
- Added a dedicated unsigned macOS client release workflow (`client-release-unsigned.yml`) for emergency delivery when notarization is delayed.
- Added local sandbox persistent storage in the desktop client with host-backed mounts for workspace and runtime state.
- Added local sandbox storage management commands (`get_sandbox_storage_info`, `reset_sandbox_storage`) and settings UI actions.

### Changed

- Updated local sandbox container lifecycle: `Stop Sandbox` now stops the container without removing it, and subsequent starts reuse existing containers.
- Updated project picker root resolution to use a stable base path (`home` first, then `/home/deck/workspace` fallback).
- Refactored `apps/client` sandbox Docker backend into focused Rust modules (`command`, `probe`, `storage`, `pull`, `lifecycle`) to improve maintainability.

### Fixed

- Pinned client release tag creation to the resolved build commit SHA in release workflows to keep published source tags aligned with built DMG artifacts.
- Hardened sandbox stop behavior to propagate Docker probe failures instead of reporting false "not found" stop success.
- Prevented sandbox storage size calculation from traversing symlinks to avoid loop and path-escape risks.

## [0.0.1-alpha.3.2] - 2026-02-28

### Added

- Client backend logging to file (`deck.log`) and stdout for improved diagnostics.
- "Open Log Directory" button on client error screens for easy troubleshooting.
- New `apps/landing` React + Vite marketing site with static asset deployment pipeline.
- Landing Docker packaging assets under `docker/landing/` and `deploy/landing/docker-compose.yml`.
- Landing deployment runbook at `docs/design/landing-deploy.md`.
- GitHub Actions workflow for building Deck landing image and optionally publishing to GHCR.
- GitHub Actions workflow for deploying `apps/landing/dist` to Cloudflare Pages.
- Client sandbox image pull progress streaming with per-layer status tracking and weighted progress bar.
- Cancel button for in-progress sandbox image pulls (Desktop placeholder and top-right dropdown).
- Pull log viewer in Viewer tab showing real-time layer status updates during image pull.
- "View Logs" guide link in Desktop placeholder to redirect users to the Viewer during pulls.

### Changed

- Landing locale fallback now defaults to English unless a user-selected locale exists in local storage.

### Fixed

- Client Docker binary detection is now more robust, searching common install paths to avoid `PATH` issues in GUI environments.
- Default sandbox Docker image name corrected from `deck/desktop-sandbox-ai:latest` to `ghcr.io/cofy-x/deck/desktop-sandbox-ai:latest`.

## [0.0.1-alpha.3] - 2026-02-26

### Added

- Client update notifications support in the desktop app (`feat(client)`, #4).

### Fixed

- Client IME input handling issues (`feat(client)`, #4).

## [0.0.1-alpha.2] - 2026-02-26

### Added

- Local credential store implementation for the desktop client (`feat(client)`, #3).

### Fixed

- `computer-use` mouse scroll hang issue, plus regression checks for no-hang behavior (`fix(computer-use)`, #1).

## [0.0.1-alpha.1] - 2026-02-25

### Added

- Public repository baseline documentation for open-source collaboration.
- `apps/client` as the primary `v0.0.1` product surface (Tauri desktop cockpit).
- Client local and remote sandbox modes with profile-based connection management.
- OpenCode session flow support (SSE events, retry, permission handling, questions).
- Remote OpenCode web bridge behavior for authenticated fullscreen use.
- Desktop noVNC integration in the client cockpit workflow.
- Pilot suite active modules (`apps/pilot/host`, `apps/pilot/bridge`, `apps/pilot/server`) for upcoming client integration.
