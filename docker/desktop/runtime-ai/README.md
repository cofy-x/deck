# Deck Desktop Runtime AI (L3)

`desktop-runtime-ai` is the AI tooling layer in the desktop sandbox image stack.
It extends `desktop-runtime-dev` and keeps AI CLI dependencies isolated from frequently changing daemon/client code.

## Layer Position

Desktop image layering:

1. `desktop-runtime-base` (L1): OS and desktop foundation
2. `desktop-runtime-dev` (L2): developer runtimes and Chrome behavior for XFCE/noVNC
3. `desktop-runtime-ai` (L3): AI CLI tooling layer (this directory)
4. `desktop-sandbox-ai` (L4): daemon + computer-use + deck CLI integration

## What This Layer Adds

- Installs `opencode-ai` globally (`opencode` command).
- Keeps AI tooling installation in a dedicated cacheable layer.

Current default is OpenCode-first for `apps/client` local sandbox flows.

## What This Layer Intentionally Does Not Add

- No `deck-daemon` process supervision.
- No computer-use REST/RPC endpoints.
- No additional AI CLIs by default (Claude Code / Gemini / Codex).

If additional AI CLIs are needed, add them in an optional follow-up layer to avoid increasing default image size and build time.

## Build and Run

From repo root:

```bash
make build-desktop-runtime-ai
make run-desktop-runtime-ai
```

Or directly in this directory:

```bash
bash build.sh
bash run.sh
```

## Quick Verification

```bash
docker run --rm --platform linux/amd64 deck/desktop-runtime-ai:latest opencode --version
```

Expected: command exits successfully and prints the OpenCode version.
