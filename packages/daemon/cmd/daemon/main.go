package main

import (
	"context"
	"errors"
	"fmt"
	"io"
	"os"
	"os/exec"
	"os/signal"
	"path/filepath"
	"sync"
	"syscall"
	"time"

	golog "log"

	"github.com/cofy-x/deck/apps/daemon/cmd/daemon/config"
	"github.com/cofy-x/deck/apps/daemon/internal"
	"github.com/cofy-x/deck/apps/daemon/internal/util"
	"github.com/cofy-x/deck/apps/daemon/pkg/ssh"
	"github.com/cofy-x/deck/apps/daemon/pkg/terminal"
	"github.com/cofy-x/deck/apps/daemon/pkg/toolbox"
	"github.com/cofy-x/deck/apps/daemon/pkg/toolbox/process"

	common_consts "github.com/cofy-x/deck/packages/core-go/pkg/consts"
	"github.com/cofy-x/deck/packages/core-go/pkg/log"
)

// Zombie Process Reaper (PID 1 Duty)
// As PID 1, we must adopt and reap orphaned child processes to prevent zombies.
func StartZombieReaper() {
	// Add buffer to prevent signal loss when multiple processes exit at once
	sigCh := make(chan os.Signal, 64)
	signal.Notify(sigCh, syscall.SIGCHLD)

	go func() {
		registry := process.GetRegistry()
		for range sigCh {
			for {
				var wstatus syscall.WaitStatus
				// -1 means wait for any child process
				// WNOHANG ensures that if there are no zombies, it returns immediately without blocking the goroutine
				pid, err := syscall.Wait4(-1, &wstatus, syscall.WNOHANG, nil)

				if err != nil {
					// ECHILD means there are no more child processes, this is a normal exit condition.
					if errors.Is(err, syscall.ECHILD) {
						break
					}
					log.Warnf("Wait4 error while reaping processes: %v", err)
					break
				}
				if pid <= 0 {
					break
				}

				// Cache exit status for all children to avoid races with fast exits.
				registry.CacheExitStatus(pid, wstatus)
				if registry.IsRegistered(pid) {
					log.Debugf("Reaped PID %d (managed by process/execute), cached exit status: %v", pid, wstatus.ExitStatus())
				} else {
					log.Debugf("Successfully reaped zombie process [PID: %d], Status: %v", pid, wstatus.ExitStatus())
				}
			}
		}
	}()
}

// StartHeartbeatMonitor periodically logs system health metrics.
// This is critical for long-running daemons to detect resource leaks (e.g., FDs).
func StartHeartbeatMonitor(interval time.Duration, version string) {
	go func() {
		ticker := time.NewTicker(interval)
		defer ticker.Stop()

		for range ticker.C {
			fdCount := util.GetFDCount()
			log.Infof("[Heartbeat] System Health - Open FDs: %d, Version: %s", fdCount, version)

			// Alert threshold: typical container limit is 1024.
			// 800 is a safe "early warning" line.
			if fdCount > 800 {
				log.Warnf("CRITICAL: High FD count detected! Possible resource leak.")
			}
		}
	}()
}

func main() {
	// 1. Mandatory PID 1 duties
	StartZombieReaper()

	// 2. Proactive health monitoring
	StartHeartbeatMonitor(5*time.Minute, internal.Version)

	// 3. Configuration and Logging
	c, err := config.GetConfig()
	if err != nil {
		panic(err)
	}

	// Check if user wants to read entrypoint logs
	args := os.Args[1:]
	if len(args) == 2 && args[0] == "entrypoint" && args[1] == "logs" {
		util.ReadEntrypointLogs(c.EntrypointLogFilePath)
		return
	}

	var logWriter io.Writer
	if c.DaemonLogFilePath != "" {
		ensureLogDir(c.DaemonLogFilePath)
		logFile, err := os.OpenFile(c.DaemonLogFilePath, os.O_APPEND|os.O_CREATE|os.O_WRONLY, 0644)
		if err != nil {
			log.Errorf("Failed to open log file at %s", c.DaemonLogFilePath)
		} else {
			defer logFile.Close()
			logWriter = logFile
		}
	}

	initLogs(logWriter)

	// If workdir in image is not set, use user home as workdir
	if c.UserHomeAsWorkDir {
		homeDir, err := os.UserHomeDir()
		if err != nil {
			log.Warnf("failed to get home directory: %v", err)
		} else {
			err = os.Chdir(homeDir)
			if err != nil {
				log.Warnf("failed to change working directory to home directory: %v", err)
			}
		}
	}

	log.Debugf("Starting Deck Daemon %s", internal.Version)

	// Execute passed arguments as command
	var entrypointCmd *exec.Cmd
	var entrypointWg sync.WaitGroup
	if len(args) > 0 {
		// used for logging in case of errors starting/waiting for the command
		entrypointLogWriter := os.Stdout
		entrypointErrLogWriter := os.Stderr

		if c.EntrypointLogFilePath != "" {
			ensureLogDir(c.EntrypointLogFilePath)
			entrypointLogFile, err := os.OpenFile(c.EntrypointLogFilePath, os.O_APPEND|os.O_CREATE|os.O_WRONLY, 0644)
			if err != nil {
				log.Errorf("Failed to open log file at %s due to %v, fallback to STDOUT and STDERR", c.EntrypointLogFilePath, err)
			} else {
				defer entrypointLogFile.Close()
				entrypointLogWriter = entrypointLogFile
				entrypointErrLogWriter = entrypointLogFile
			}
		}

		entrypointCmd = exec.Command(args[0], args[1:]...)
		entrypointCmd.Env = os.Environ()
		entrypointCmd.Stdout = entrypointLogWriter
		entrypointCmd.Stderr = entrypointErrLogWriter

		// Start the command and wait for it in a background goroutine.
		// This ensures the child process is properly reaped (preventing zombies)
		// while allowing the daemon to continue initialization without blocking.
		startErr := entrypointCmd.Start()
		if startErr != nil {
			fmt.Fprintf(entrypointErrLogWriter, "failed to start command: %v\n", startErr)
		} else {
			entrypointWg.Add(1)
			go func() {
				defer entrypointWg.Done()
				if err := entrypointCmd.Wait(); err != nil {
					fmt.Fprintf(entrypointErrLogWriter, "command exited with error: %v\n", err)
				} else {
					fmt.Fprint(entrypointLogWriter, "Entrypoint command completed successfully\n")
				}
			}()
		}
	}

	errChan := make(chan error)

	workDir, err := os.Getwd()
	if err != nil {
		panic(fmt.Errorf("failed to get current working directory: %w", err))
	}

	toolBoxServer := &toolbox.Server{
		WorkDir: workDir,
	}

	// Start the toolbox server in a go routine
	go func() {
		err := toolBoxServer.Start()
		if err != nil {
			errChan <- err
		}
	}()

	// Start terminal server
	go func() {
		if err := terminal.StartTerminalServer(22222); err != nil {
			errChan <- err
		}
	}()

	sshServer := &ssh.Server{
		WorkDir:        workDir,
		DefaultWorkDir: workDir,
	}
	go func() {
		if err := sshServer.Start(); err != nil {
			errChan <- err
		}
	}()

	// Set up signal handling for graceful shutdown
	sigChan := make(chan os.Signal, 1)
	signal.Notify(sigChan, syscall.SIGINT, syscall.SIGTERM)

	// Wait for either an error or shutdown signal
	select {
	case err := <-errChan:
		log.Errorf("Error: %v", err)
	case sig := <-sigChan:
		log.Infof("Received signal %v, shutting down gracefully...", sig)
	}

	// Graceful shutdown
	log.Info("Stopping computer use processes...")
	if toolBoxServer.ComputerUse != nil {
		_, err := toolBoxServer.ComputerUse.Stop()
		if err != nil {
			log.Errorf("Failed to stop computer use: %v", err)
		}
	}

	// Handle entrypoint command shutdown
	if entrypointCmd != nil && entrypointCmd.Process != nil {
		log.Info("Waiting for entrypoint command to complete...")

		// Create a channel to signal when WaitGroup is done
		done := make(chan struct{})
		go func() {
			entrypointWg.Wait()
			close(done)
		}()

		// Wait with timeout for graceful completion
		timer := time.NewTimer(time.Duration(c.EntrypointShutdownTimeoutSec) * time.Second)
		select {
		case <-done:
			log.Info("Entrypoint command completed")
			if !timer.Stop() {
				<-timer.C
			}
		case <-timer.C:
			log.Warn("Entrypoint command did not complete within timeout, sending SIGTERM...")
			if err := entrypointCmd.Process.Signal(syscall.SIGTERM); err != nil {
				log.Errorf("Failed to send SIGTERM to entrypoint command: %v", err)
			}

			// Wait a bit more for SIGTERM to take effect
			ctx, cancel := context.WithTimeout(context.Background(), time.Duration(c.SigtermShutdownTimeoutSec)*time.Second)
			defer cancel()

			gracefulDone := make(chan struct{})
			go func() {
				entrypointWg.Wait()
				close(gracefulDone)
			}()

			select {
			case <-gracefulDone:
				log.Info("Entrypoint command terminated gracefully")
			case <-ctx.Done():
				log.Warn("Entrypoint command did not respond to SIGTERM, sending SIGKILL...")
				if err := entrypointCmd.Process.Kill(); err != nil {
					log.Errorf("Failed to kill entrypoint command: %v", err)
				}
				entrypointWg.Wait()
				log.Info("Entrypoint command killed")
			}
		}
	}

	log.Info("Shutdown complete")
}

func ensureLogDir(filePath string) {
	if filePath == "" {
		return
	}

	dir := filepath.Dir(filePath)
	if dir == "" || dir == "." {
		return
	}

	if err := os.MkdirAll(dir, 0755); err != nil {
		fmt.Fprintf(os.Stderr, "Failed to create log directory %s: %v\n", dir, err)
	}
}

func initLogs(logWriter io.Writer) {
	logLevel := "warn"

	logLevelEnv, logLevelSet := os.LookupEnv(common_consts.EnvDeckLogLevel)

	if logLevelSet {
		logLevel = logLevelEnv
	}

	// Always use pretty (console) format for daemon
	pretty := true

	if logWriter != nil {
		// Write to both stdout and file
		log.InitWithWriter(logLevel, io.MultiWriter(os.Stdout, logWriter), pretty)
	} else {
		log.Init(logLevel, pretty)
	}

	// Redirect standard Go log to our debug logger
	golog.SetOutput(&log.DebugLogWriter{})
}
