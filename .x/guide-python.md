# Guide: Python Workspace (`apps/server-py`, `packages/core-py`)

## Purpose

This guide covers the Python workspace managed by `uv`.

## Boundaries

- `apps/server-py`: placeholder service module for Python runtime integration checks.
- `packages/core-py`: placeholder shared Python package scaffold.
- Neither module is a current production backend path.

## Entrypoints

- Server placeholder script: `apps/server-py/hello.py`
- Shared package module: `packages/core-py/src/core_py/__init__.py`
- Workspace config: `pyproject.toml`

## Dev Commands

```bash
# Sync Python workspace dependencies
uv sync --all-packages

# Run the placeholder server package command
uv run --package server-py python apps/server-py/hello.py
```

## Config / Env

- Python version: `>=3.12`
- Local workspace mapping is declared in `[tool.uv.workspace]` and `[tool.uv.sources]`.

## Tests

- No dedicated automated tests are defined for placeholder modules currently.

## Read Next

- `apps/server-py/README.md`
- `packages/core-py/README.md`
- `.x/module-status.md`

## Common Pitfalls

- Do not treat these modules as active production surfaces unless status changes in `.x/module-status.md`.
