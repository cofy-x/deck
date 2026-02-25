package common

import (
	"context"
	"errors"
	"fmt"
	"io"
	"os"
	"os/exec"
	"strings"
	"sync"
	"syscall"
	"time"
	"unsafe"

	"github.com/cofy-x/deck/packages/core-go/pkg/log"
	"github.com/creack/pty"
)

type TTYSize struct {
	Height int
	Width  int
}

type SpawnTTYOptions struct {
	Context   context.Context
	SessionID string // Added for tracking
	Dir       string
	StdIn     io.Reader
	StdOut    io.Writer
	Term      string
	Env       []string
	SizeCh    <-chan TTYSize
}

// SpawnTTY starts a PTY session and blocks until the process exits or IO fails.
// It handles Linux-specific PTY EIO errors and ensures process reaping.
func SpawnTTY(opts SpawnTTYOptions) error {
	sid := opts.SessionID
	shell := GetShell()
	cmd := exec.Command(shell)
	cmd.Dir = opts.Dir

	cmd.Env = append(cmd.Env, fmt.Sprintf("TERM=%s", opts.Term))
	cmd.Env = append(cmd.Env, os.Environ()...)
	cmd.Env = append(cmd.Env, fmt.Sprintf("SHELL=%s", shell))
	cmd.Env = append(cmd.Env, opts.Env...)

	// 1. Start the PTY and the Shell process
	f, err := pty.Start(cmd)
	if err != nil {
		return fmt.Errorf("[%s] failed to start pty: %w", sid, err)
	}

	// 2. Safe Close Mechanism
	// Prevents double-close race conditions between the main thread and the watchdog.
	var closeOnce sync.Once
	safeClose := func() {
		closeOnce.Do(func() {
			log.Debugf("[%s] Closing PTY master file descriptor", sid)
			_ = f.Close()
		})
	}
	defer safeClose()

	// 3. Global Safety: Ensure process is killed and reaped if we return early
	defer func() {
		if cmd.Process != nil {
			_ = cmd.Process.Kill()
		}
		_ = cmd.Wait()
		log.Infof("[%s] Shell process reaped in cleanup defer", sid)
	}()

	// 4. Watchdog for disconnects
	go func() {
		<-opts.Context.Done()
		if cmd.Process != nil {
			log.Infof("[%s] Client disconnected, terminating PID: %d", sid, cmd.Process.Pid)
			// Step A: Attempt graceful termination
			_ = cmd.Process.Signal(syscall.SIGTERM)

			// Step B: Wait for a short window for the process to exit naturally
			timer := time.NewTimer(2 * time.Second)
			<-timer.C
			timer.Stop()

			// Step C: Force kill if still alive
			_ = cmd.Process.Kill()
		}
		// Explicitly close the PTY master to unblock any pending io.Copy calls
		safeClose()
	}()

	// 5. Resize handling
	done := make(chan struct{})
	defer close(done)
	go func() {
		for {
			select {
			case win, ok := <-opts.SizeCh:
				if !ok {
					return
				}
				// Set the new terminal size via TIOCSWINSZ ioctl
				_, _, errno := syscall.Syscall(
					syscall.SYS_IOCTL,
					f.Fd(),
					uintptr(syscall.TIOCSWINSZ),
					uintptr(unsafe.Pointer(&struct{ h, w, x, y uint16 }{
						uint16(win.Height), uint16(win.Width), 0, 0,
					})),
				)
				if errno != 0 {
					log.Warnf("[%s] ioctl resize error: %v", sid, errno)
				}
			case <-done:
				return
			}
		}
	}()

	// 6. Input/Output Relay
	go func() { _, _ = io.Copy(f, opts.StdIn) }()

	// 7. Output Relay (PTY Master -> SSH Channel)
	// This blocks until the shell exits or the PTY is closed.
	_, copyErr := io.Copy(opts.StdOut, f)

	//8. Linux EIO normalization
	if copyErr != nil && (errors.Is(copyErr, syscall.EIO) || strings.Contains(copyErr.Error(), "input/output error")) {
		log.Debugf("[%s] PTY I/O loop ended naturally via EIO", sid)
		copyErr = nil
	}

	// 9. Process Reaping & Exit Code Extraction
	// Since deck-daemon is PID 1, it may have already reaped this process.
	// We handle "Wait was already called" and "no child processes" (ECHILD) gracefully.
	waitErr := cmd.Wait()
	if waitErr != nil {
		errStr := waitErr.Error()
		if strings.Contains(errStr, "already finished") ||
			strings.Contains(errStr, "Wait was already called") ||
			strings.Contains(errStr, "no child processes") {
			log.Debugf("[%s] Shell process was reaped by the global PID 1 supervisor", sid)
			waitErr = nil
		}
	}

	if copyErr != nil {
		return fmt.Errorf("[%s] pty io error: %w", sid, copyErr)
	}
	return waitErr
}
