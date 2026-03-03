# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project follows [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.0.1] - 2026-03-03

### Added

- First stable desktop release line for Deck (`v0.0.1`), rolling up capabilities from the `0.0.1-alpha.*` preview cycle.
- Added top-bar developer handoff actions for workspace continuation in `Editor (VS Code/Cursor)`, `OpenCode`, and `Terminal`.
- Added desktop external-editor integration via `open_project_in_editor`, including managed local SSH host alias setup for `deck-local`.
- Added connection-settings credential collapse behavior with local-first hints and remote auth-error auto-expand.
- Added reusable shortcut tooltip content UI (`ShortcutTooltipContent`) and shortcut key formatting utilities for platform-aware `mod` display (`⌘` on macOS, `Ctrl` otherwise).
- Added markdown normalization utility tests covering ordered-list normalization, bullet nesting boundaries, fenced-code protection, nested markdown-fence handling, and unbalanced fence auto-close.
- Added shortcut formatting unit tests for `userAgentData`, iPadOS desktop-mode UA fallback, and key-sequence formatting behavior.

### Changed

- Updated product positioning copy in `README.md`, `README.zh-CN.md`, and `apps/landing` to center the `Cockpit + Dev Handoff` workflow and treat Pilot as an optional ecosystem suite.
- Updated architecture/roadmap wording in docs and landing content to clarify Pilot workflow continuity without implying first-class client UI integration.
- Updated chat input send control to use an upward arrow icon and tooltip keycap hint (`Enter`), while preserving existing send behavior (`Enter` send, `Shift+Enter` newline, IME guard).
- Updated right-panel interactions to standardize shortcut tooltips for collapse/expand, fullscreen close (`Esc`), and tab-cycle behavior (`Cmd/Ctrl + Shift + V`) including debug-mode tab cycling.
- Updated assistant message rendering to support a high-contrast markdown tone for improved readability without changing user message bubble styling.
- Updated stop action button visual style to align with the send button's neutral primary appearance.

### Fixed

- Fixed local editor launch host-resolution failures by ensuring Deck-managed SSH include entries are written at top-level in `~/.ssh/config`.
- Fixed a React hooks ordering issue in `project-open-actions` by keeping hooks unconditional across renders.
- Fixed tooltip arrow rendering to avoid keycap overlap/visual clipping by using a standard single-arrow shape and configurable arrow visibility.
- Fixed markdown list rendering for LLM-style outputs using `1)` markers with immediate bullet details, so ordered numbering and nested bullets render consistently.
- Fixed markdown normalization fence-state handling so list normalization does not leak into fenced `md` examples and nested fence samples are preserved safely.
- Fixed SSE log-summary test expectations to keep `message.part.updated` treated as non-loggable.

## [0.0.1-alpha.6] - 2026-03-02

### Changed

- Updated release messaging in `README.md` and `README.zh-CN.md` to reflect the current macOS desktop distribution status and the Windows/Linux roadmap.
- Updated `apps/landing/src/content/site-content.ts` (EN/ZH) to align quick-start copy and trust chips with current platform availability messaging.
- Updated `docs/design/client-update-check.md` to replace outdated unsigned-DMG assumptions with the signed/notarized macOS release workflow status.

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
