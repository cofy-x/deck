# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project follows [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- New `apps/landing` React + Vite marketing site with static asset deployment pipeline.
- Landing Docker packaging assets under `docker/landing/` and `deploy/landing/docker-compose.yml`.
- Landing deployment runbook at `docs/design/landing-deploy.md`.
- GitHub Actions workflow for building Deck landing image and optionally publishing to GHCR.
- GitHub Actions workflow for deploying `apps/landing/dist` to Cloudflare Pages.

### Changed

- Landing locale fallback now defaults to English unless a user-selected locale exists in local storage.

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
