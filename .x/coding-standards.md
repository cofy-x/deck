# Coding Standards

Rules and conventions for AI agents and developers working on the deck monorepo.

## Core Principles

1. **Symmetry Across Languages** — Maintain consistent naming and structural patterns across Go, Rust, TypeScript, and Python.
2. **DRY at Monorepo Scale** — Never implement the same logic twice in different `apps/`. Reusable code **must** live in `packages/`.
3. **Truth in the Right Place**:
   - **System/IO/Persistence** → Rust or Go
   - **AI/Data Processing** → Python
   - **Presentation/UI State** → React (TypeScript)
4. **Types-First** — Define schemas and types in shared packages before implementing in apps.

## Directory Governance

- **`apps/`** — Deliverables only (entry points, API routes, UI views). No shared logic.
- **`packages/`** — Shared logic, types, and libraries consumed by multiple apps.
- **Refactoring Trigger** — If you write the same logic in 2+ `apps/`, stop and move it to `packages/core-<lang>`.

## Language-Specific Conventions

### TypeScript

- **Strict mode** enabled (`noImplicitAny`, `strictNullChecks`, etc.).
- **ESM only** — Use `import`/`export`. Never use `require()`.
- **Consistent type imports** — Use `import type { Foo } from '...'` for type-only imports.
- **No `any`** — `@typescript-eslint/no-explicit-any` is enforced (relaxed only in `components/ui/`).
- **Unused variables** — Prefix with `_` (e.g., `_unused`).
- **Validation** — Use **Zod** for all schema validation.
- **License header** — Every `.ts`/`.tsx`/`.js` file must include:
  ```
  /**
   * @license
   * Copyright 2026 cofy-x
   * SPDX-License-Identifier: Apache-2.0
   */
  ```

### Go

- **Format** — Run `go fmt` before committing.
- **Concurrency** — Use goroutines + channels. Follow standard Go patterns.
- **Static build** — `CGO_ENABLED=0` for daemon and CLI binaries.
- **Module structure** — Each Go module under `packages/` or `apps/` has its own `go.mod`, coordinated via `go.work`.

### Rust

- **Async runtime** — Use `Tokio`.
- **Error handling** — Use `Result<T, E>` with meaningful error types.
- **Tauri** — Rust code in `src-tauri/` serves as the backend for Tauri desktop apps.

### Python

- **Package manager** — Use `uv`. Run `uv sync --all-packages` after any dependency change.
- **Import mapping** — `packages/core-py` maps to `core_py` module.
- **Workspace deps** — Use `{ workspace = true }` for local package references.
- **Version** — Python >= 3.12.

## Dependency Management

| Language | Add dependency | Sync/Install |
| :--- | :--- | :--- |
| TS/JS | `pnpm add <pkg>` (in app/package dir) | `pnpm install` |
| Python | `uv add <pkg>` (in app dir) | `uv sync --all-packages` |
| Go | `go get <pkg>` + `go work use <path>` for new modules | `go mod download` |
| Rust | `cargo add <crate>` (in Cargo.toml dir) | `cargo build` |

## File & Path Conventions

- **Verify paths** before creating files — check against the actual directory structure.
- **Explicit imports** — Use absolute imports with `@/` aliases in React apps.
- **No hardcoded secrets** — Use `.env.example` as the template. Never commit `.env`.

## Documentation

- Every new exported function, struct, or class in `packages/` must include docstrings (TSDoc, GoDoc, or Python Docstrings).
- Keep documentation in English.
- Use concise, descriptive names.

## Git & Workflow

- **Commit messages** — Follow [Conventional Commits](https://www.conventionalcommits.org/):
  ```
  feat(client): add sandbox status panel
  fix(daemon): resolve PTY EOF handling
  refactor(core-ts): extract shared validation utils
  docs(pilot): update bridge setup guide
  ```
- **Scope** — Use the app or package name as scope (e.g., `client`, `daemon`, `core-ts`, `pilot-bridge`).
- **Environment** — Use `.env.example` as source of truth for env vars.
