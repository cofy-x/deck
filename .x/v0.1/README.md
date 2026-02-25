# Deck AI v0.1 - Release Documentation

> Status: **HISTORICAL**. This directory captures v0.1 snapshots and is not the primary source for current implementation decisions.

## What is Deck?

**Deck** is a desktop-native AI Cockpit that provides autonomous AI agents with a full Linux sandbox environment. Users interact via a split-pane interface: **Chat** (left) for AI conversations, and **Desktop/Viewer** (right) for real-time sandbox observation. The product is built as a **Tauri 2.0** desktop application (Rust + React).

---

## v0.1 Scope

v0.1 delivers the **foundational end-to-end pipeline**: from launching a Docker sandbox to conducting multi-turn AI conversations with tool execution, file viewing, and model/provider management.

### Key Capabilities

| Category | Feature | Status |
|:---|:---|:---|
| **Sandbox** | Docker container lifecycle (pull, start, stop) | Done |
| **Sandbox** | noVNC desktop streaming (1280x720) | Done |
| **Sandbox** | Multi-stage boot sequence with progress UI | Done |
| **AI Chat** | Multi-turn sessions via OpenCode Server | Done |
| **AI Chat** | Real-time SSE event streaming with auto-reconnect | Done |
| **AI Chat** | Markdown rendering with syntax highlighting (Shiki) | Done |
| **AI Chat** | Tool call logs, reasoning blocks, file diffs | Done |
| **AI Chat** | Permission and question dialogs | Done |
| **AI Chat** | File attachments in prompts | Done |
| **Configuration** | Model selection (client-side, persisted) | Done |
| **Configuration** | Agent selection (primary, non-hidden agents) | Done |
| **Configuration** | Provider authentication (API keys, OAuth) | Done |
| **Configuration** | Custom provider configuration | Done |
| **Configuration** | Model visibility management | Done |
| **Project** | Project directory picker (`/home/deck`) | Done |
| **Project** | Session scoping by project directory | Done |
| **Status** | MCP/LSP/Formatter server status indicators | Done |
| **Status** | Brain status (Idle/Thinking/Executing) | Done |
| **Viewer** | Code viewer with syntax highlighting | Done |
| **Viewer** | Diff viewer for file changes | Done |
| **Viewer** | Markdown viewer | Done |
| **Developer** | API call logging to Tauri backend console | Done |

---

## Documentation Index

| Document | Description |
|:---|:---|
| [Product Design](./product-design.md) | Functional requirements, user flows, UI/UX specifications |
| [Architecture Design](./architecture-design.md) | Technical architecture, data flows, component hierarchy, implementation guide |

### Related Documents

| Document | Description |
|:---|:---|
| [Frontend Guidelines](../guide-frontend.md) | Tech stack, coding standards, component patterns |
| [Daemon Design](../../docs/design/daemon.md) | PID 1 daemon, zombie reaping, PTY, SSH/WS servers |
| [OpenCode Server API](../../docs/opencode/overview.md) | Full OpenCode HTTP API reference |
| [Sandbox Image](../../docker/desktop/sandbox-ai/README.md) | Docker image layers, computer-use capabilities |
| [Project Overview](../project-overview.md) | Monorepo directory structure and workspace guide |

---

## Quick Start for AI Agents

### Understanding the System

1. Read this README for the feature overview
2. Read [Architecture Design](./architecture-design.md) for the technical deep-dive
3. Reference [OpenCode Server API](../../docs/opencode/overview.md) when working with backend integration
4. Follow [Frontend Guidelines](../guide-frontend.md) for code conventions

### Key Entry Points

| What | Where |
|:---|:---|
| App entry | `apps/client/src/main.tsx` |
| Root layout | `apps/client/src/components/layout/cockpit-layout.tsx` |
| Chat panel | `apps/client/src/components/chat/chat-panel.tsx` |
| OpenCode SDK client | `apps/client/src/lib/opencode.ts` |
| All stores | `apps/client/src/stores/` |
| All hooks | `apps/client/src/hooks/` |
| Tauri commands | `apps/client/src-tauri/src/lib.rs` |
| Docker operations | `apps/client/src-tauri/src/sandbox/docker.rs` |

### Development Commands

```bash
# Start development (Tauri + Vite)
cd apps/client && pnpm tauri dev

# Lint the entire workspace
pnpm run lint

# TypeScript check
cd apps/client && pnpm tsc --noEmit

# Build production
cd apps/client && pnpm tauri build

# Add a shadcn/ui component
cd apps/client && pnpm dlx shadcn@latest add <component-name>
```

---

## Known Limitations (v0.1)

- Model selection is client-side only; the backend config is not updated (by design, matching OpenCode web behavior)
- SSE stream may miss events during reconnection
- The viewer panel shares space with the VNC desktop (tab switching, not simultaneous)
- No session persistence across sandbox restarts (sessions are stored inside the container)
- Custom provider configuration requires manual JSON-level knowledge of `@ai-sdk/openai-compatible` options
