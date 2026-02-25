# Deck Daemon: Technical Design & Architecture

The **Deck Daemon** is a high-performance, production-ready system agent designed to operate as the **PID 1 (Init process)** within an AI Sandbox container. It provides a robust bridge between remote interfaces (SSH, Web Terminal) and the local sandbox environment, ensuring process stability, resource integrity, and seamless AI tool integration.

---

## 1. System Architecture Overview

The daemon is structured to handle concurrent remote sessions while fulfilling the duties of a Linux Init process. It abstracts complex TTY/PTY interactions into a unified `SpawnTTY` core, which is consumed by both the SSH and WebSocket servers.

### 1.1 PID 1 Responsibilities

In a containerized environment, the Deck Daemon assumes the role of **Init**. It is responsible for:

- **Signal Forwarding:** Propagating system signals to child processes.
- **Zombie Reaping:** Automatically adopting and reaping orphaned processes to prevent PID exhaustion.

### 1.2 PTY Communication Flow

Every interactive session follows a strict data pipeline: `Transport (SSH/WS) <-> IO Pipes <-> PTY Master <-> PTY Slave <-> Shell (Zsh/Bash)`

---

## 2. Core Components

### 2.1 Zombie Reaper (`StartZombieReaper`)

To prevent "zombie" processes (defunct processes that remain in the process table), the daemon implements a non-blocking reaper:

- **Mechanism:** Listens for `syscall.SIGCHLD` signals.
- **Execution:** Runs a `syscall.Wait4` loop with the `WNOHANG` flag to clean up all exited children without blocking the main event loop.

### 2.2 Terminal PTY Core (`SpawnTTY`)

The `SpawnTTY` function is the most critical component, hardened for Linux-specific behaviors:

- **EIO Normalization:** On Linux, reading from a PTY master returns an `EIO` error when the slave closes. The daemon normalizes this as a standard `EOF` to prevent false-positive error logs.
- **Safe-Close Pattern:** Uses `sync.Once` to ensure the PTY Master file descriptor is closed exactly once, preventing race conditions between the Watchdog and the main thread.
- **Resize Buffering:** Implements a buffered channel for `TIOCSWINSZ` ioctl calls to handle high-frequency terminal window resizing without freezing the session.

### 2.3 UTF-8 Stream Decoder

To support Web Terminals, the daemon includes a stateful `UTF-8 Decoder`:

- **Fragmentation Handling:** It buffers incomplete multi-byte characters (up to 3 bytes) and prepends them to the next data chunk. This prevents the "random garbled text" common in low-bandwidth or high-frequency terminal output.

---

## 3. Remote Access Servers

### 3.1 SSH Server

Built on `gliderlabs/ssh`, the server provides a professional CLI experience:

- **Session Traceability:** Every session is assigned a unique `SessionID` (e.g., `[SSH-a1b2c3d4]`) for granular log analysis.
- **Agent Forwarding:** Supports SSH agent forwarding to allow AI tools (like `claude-code`) to use local Git credentials securely.
- **Reaper Compatibility:** Gracefully handles "already reaped" errors when the global reaper clears a process before the local session handler finishes.

### 3.2 Web Terminal (WebSocket)

Provides a zero-install terminal experience via the browser:

- **Authentication:** Token-based authentication via the `X-Deck-Token` header.
- **IO Synchronization:** Uses `io.Pipe` to bridge the synchronous PTY Master with the asynchronous WebSocket loop, ensuring no data loss during high-output bursts.

---

## 4. Reliability & Observability

### 4.1 Heartbeat Monitoring

The daemon includes a proactive monitoring goroutine that samples system metrics every 5 minutes:

- **Metric:** Open File Descriptors (FD) count.
- **Threshold:** Warns at >800 FDs (assuming a default container limit of 1024) to detect resource leaks before they cause a system crash.

### 4.2 Graceful Shutdown Pipeline

The shutdown sequence is designed to protect user data and ensure clean exits:

1. **Stop External Services:** Halts the Toolbox and Computer-Use processes.
2. **Grace Period:** Sends `SIGTERM` to the entrypoint command and waits for a configurable timeout.
3. **Forced Cleanup:** Executes `SIGKILL` as a last resort if processes fail to respond, ensuring the container exits cleanly without hung processes.

## 5. Production Readiness Checklist

| Feature               | Implementation Detail                                         |
| --------------------- | ------------------------------------------------------------- |
| **Zombie Prevention** | Buffered `SIGCHLD` channel + `Wait4` loop.                    |
| **Memory Efficiency** | Minimal UTF-8 buffer (4 bytes) and `strings.Builder`.         |
| **Concurrency**       | Non-blocking resize channels and safe `context` cancellation. |
| **Traceability**      | Unique Session IDs for all PTY/SSH/WS logs.                   |
| **Resilience**        | Linux-specific PTY `EIO` error handling.                      |

> **Note:** This daemon is intended to run as the primary entrypoint of the Docker image. Ensure the `deck` user has sufficient permissions for `/dev/ptmx` and that the environment variable `DECK_DAEMON_TOKEN` is securely injected via Kubernetes Secrets.

## 6. Build & Deployment Standards

- **Static Compilation**: The binary must be built with `CGO_ENABLED=0` to ensure it runs across different Linux distributions without shared library conflicts.
- **User Identity**: While the daemon starts as `root` to manage system-level PTY allocation, all user-facing shells and tools MUST be executed under the `deck` (UID 1000) user identity.
- **FS Permissions**: The daemon requires read/write access to `/dev/ptmx` and must ensure that generated PTY slaves in `/dev/pts/` are chowned to the `deck` user.
