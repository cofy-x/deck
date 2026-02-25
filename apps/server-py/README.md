# Server Python (`apps/server-py`)

> Status: **PLACEHOLDER**.

This package is a Python workspace placeholder service.

## Entrypoints

- Demo script: `hello.py`
- Package config: `pyproject.toml`

## Development

```bash
uv sync --all-packages
uv run --package server-py python apps/server-py/hello.py
```

## Notes for AI Agents

- This is not a production backend path today.
- Keep shared Python logic in `packages/core-py` when needed.
