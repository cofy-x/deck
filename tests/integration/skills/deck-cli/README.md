# deck-cli Skill Integration Tests

This directory contains Bash integration tests for core scripts in:

- `skills/deck-cli/scripts`

The suite builds local artifacts, starts a dedicated desktop sandbox container with test-only ports, waits for `computer-use` readiness, validates mouse scroll no-hang regression checks (CLI + HTTP), then executes script-level assertions.

## Covered Scripts

- `health-check.sh`
- `diagnose.sh`
- `run-tests.sh` (success and failure paths)
- `backup-files.sh`
- `batch-replace.sh` (preview and execute)
- `git-safe-commit.sh`

## Additional Coverage

- `deck computer mouse scroll` no-hang regression checks (`down` and `up`)
- `POST /computeruse/mouse/scroll` no-hang regression checks (`down` and `up`)

## Test Ports

The suite intentionally avoids default ports used by:

- `docker/desktop/sandbox-ai/run.sh`
- `docker/desktop/sandbox-ai/run-opencode.sh`

Default test mappings:

- `HOST_DAEMON_PORT=13280`
- `HOST_OPENCODE_PORT=15496`
- `HOST_VNC_PORT=16911`
- `HOST_NOVNC_PORT=17090`
- `HOST_SSH_PORT=13230`
- `HOST_WEB_TERMINAL_PORT=13232`

## Usage

Run from repo root:

```bash
bash tests/integration/skills/deck-cli/run-suite.sh
```

## Environment Variables

- `DECK_SKILL_TEST_CONTAINER_NAME` (default: `deck-desktop-sandbox-ai-skill-test`)
- `DECK_SKILL_TEST_IMAGE` (default: `deck/desktop-sandbox-ai:latest`)
- `DECK_SKILL_TEST_SKIP_BUILD` (default: `0`)
- `DECK_SKILL_TEST_TIMEOUT_SEC` (default: `180`)
- `DECK_SKILL_TEST_SCROLL_TIMEOUT_SEC` (default: `8`)
- `DECK_SKILL_TEST_START_RETRY_INTERVAL_SEC` (default: `10`)
- `DECK_SKILL_TEST_ROOT` (default: `/tmp/deck-skill-it`)

Port overrides are also supported:

- `HOST_DAEMON_PORT`
- `HOST_OPENCODE_PORT`
- `HOST_VNC_PORT`
- `HOST_NOVNC_PORT`
- `HOST_SSH_PORT`
- `HOST_WEB_TERMINAL_PORT`

## Notes

- Startup reuses `docker/desktop/sandbox-ai/run-opencode.sh` with environment-variable overrides.
- Readiness gate first calls `POST /computeruse/start`, then polls `GET /computeruse/status` and requires HTTP `200` with status `active` or `partial`.
- The suite always attempts container cleanup via `trap`.
