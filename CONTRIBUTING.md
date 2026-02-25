# Contributing to deck

Thanks for contributing to `deck`.

Before opening an issue or pull request, please read:

- [Code of Conduct](CODE_OF_CONDUCT.md)
- [Security Policy](SECURITY.md)
- [Project Overview](.x/project-overview.md)
- [Coding Standards](.x/coding-standards.md)

## Development Setup

### Prerequisites

- Node.js `>= 20`
- `pnpm`
- Go
- Rust toolchain
- Python `>= 3.12` with `uv`
- Docker

### Install Dependencies

```bash
make install
```

## Branch and Commit Workflow

- Create a branch from `main`.
- Keep changes scoped to one concern per pull request.
- Use [Conventional Commits](https://www.conventionalcommits.org/):

```text
feat(client): add sandbox status panel
fix(daemon): handle PTY EOF correctly
docs(readme): update client-first quick start
```

- Suggested scopes: `client`, `api`, `dashboard`, `pilot-host`, `pilot-bridge`, `pilot-server`, `daemon`, `core-ts`, `core-go`, `docs`.

## Code and Documentation Rules

- Keep all code, comments, docs, and identifiers in English.
- Do not duplicate reusable logic across apps; shared logic belongs in `packages/`.
- Validate paths and module status before adding new directories/files.
- For TypeScript/JavaScript source files, keep the required license header.

## Validation Before Pull Request

Run relevant checks locally before opening a PR:

```bash
make build
make test
make lint
pnpm run docs:check
```

If your change targets a subset of modules, run at least the checks relevant to that scope and explain any skipped checks in the PR.

## Pull Request Checklist

- Clear problem statement and solution summary.
- Linked issue (if applicable).
- Evidence of testing (logs, screenshots, or command output summary).
- Backward compatibility notes (if behavior changes).
- Documentation updates included when interfaces or workflows changed.

## Reporting Issues

- Bugs: use the Bug Report issue template.
- Feature requests: use the Feature Request template.
- Security issues: do **not** open a public issue; follow [SECURITY.md](SECURITY.md).
