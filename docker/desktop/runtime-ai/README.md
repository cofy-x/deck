# Deck AI Sandbox

The **Deck AI Sandbox** is an advanced, high-performance container environment designed for AI-driven development and autonomous "computer-use" tasks. Built on the `deck-base-sandbox`, it leverages the **Deck Daemon** as PID 1 to provide industrial-grade process management and stability.

---

## 🚀 Key Features

- **Integrated AI Toolchain**: Pre-installed with modern AI CLIs including `claude-code`, `gemini-cli`, `opencode-ai`, and `codex`.
- **Deck Daemon (PID 1)**: A custom Go-based init system that handles zombie process reaping, signal forwarding, and graceful shutdowns.
- **Computer-Use API**: Built-in REST/RPC endpoints for mouse/keyboard control, screen capture, and dynamic browser orchestration.
- **Developer Productivity**: Full XFCE4 desktop environment with Zsh, Node.js, Go, and Rust runtimes.
- **Dynamic Chrome Management**: Optimized Google Chrome instance with CDP (Remote Debugging) enabled for AI agents.

---

## 🛠 Image Hierarchy

This image is the final layer of a strategic build process:

1. **`base-desktop`**: Core GUI infrastructure (Xvfb, VNC, Xfce4).
2. **`deck-dev`**: Developer stack (Node.js, Go, Rust, Chrome).
3. **`deck-base-sandbox`**: Integrates `deck-daemon` as the system init (PID 1).
4. **`deck-ai-sandbox`**: (This image) Adds specialized AI developer tools.

---

## 💻 Recommended Resources (Kubernetes)

To prevent latency in **VS Code Remote-SSH** and ensure smooth performance for the **AI CLI** tools and **Chrome**, the following resource specifications are recommended:

### Resource Requests & Limits

| Resource   | Request           | Limit             | Reason                                                          |
| ---------- | ----------------- | ----------------- | --------------------------------------------------------------- |
| **CPU**    | `2000m` (2 vCPUs) | `4000m` (4 vCPUs) | Ensures UI responsiveness and fast AI indexing.                 |
| **Memory** | `4Gi`             | `8Gi`             | Prevents OOM crashes during heavy multi-tab browsing or builds. |

### Shared Memory (Critical)

Chrome and the X Server require significant shared memory to prevent crashes or "white screen" issues. **Do not rely on the default 64Mi limit.** You must mount a memory-backed volume to `/dev/shm`:

```yaml
volumeMounts:
  - name: dshm
    mountPath: /dev/shm
volumes:
  - name: dshm
    emptyDir:
      medium: Memory
      sizeLimit: '1Gi'
```

## 📦 Installed AI Tools

| Tool            | Command    | Description                                            |
| --------------- | ---------- | ------------------------------------------------------ |
| **Claude Code** | `claude`   | Anthropic’s official CLI for agentic coding.           |
| **Gemini CLI**  | `gemini`   | Google’s toolchain for interacting with Gemini models. |
| **OpenCode AI** | `opencode` | AI-powered coding assistant and workspace manager.     |
| **Codex**       | `codex`    | OpenAI’s legacy/specialized coding interface.          |

## 🔧 Usage & Deployment

### Building the Image

From the project root, use the provided `Makefile`:

```bash
make build-ai
```

### Deploying to Kubernetes

Deploy the StatefulSet using the `deck` namespace:

```
make deploy-orb TYPE=ai
```

### API Access

The **Deck Daemon** exposes a toolbox API (default port `2280`) for external control:

- **Status**: `GET /computeruse/status`
- **Open Browser**: `POST /computeruse/browser/open`
- **Screenshot**: `GET /computeruse/screenshot/compressed`

## 🛡 Security & Isolation

The sandbox utilizes **Privilege Separation**. While the daemon manages system-level duties as root, all AI tools and desktop applications are executed as the `deck` user via `SysProcAttr.Credential` to ensure your host system remains secure.
