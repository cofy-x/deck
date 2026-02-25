package process

import (
	"bytes"
	"errors"
	"net/http"
	"os"
	"os/exec"
	"strconv"
	"strings"
	"syscall"
	"time"

	"github.com/cofy-x/deck/packages/core-go/pkg/log"

	"github.com/gin-gonic/gin"
)

// ExecuteCommand godoc
//
//	@Summary		Execute a command
//	@Description	Execute a shell command and return the output and exit code
//	@Tags			process
//	@Accept			json
//	@Produce		json
//	@Param			request	body		ExecuteRequest	true	"Command execution request"
//	@Success		200		{object}	ExecuteResponse
//	@Router			/process/execute [post]
//
//	@id				ExecuteCommand
func ExecuteCommand(c *gin.Context) {
	var request ExecuteRequest
	if err := c.ShouldBindJSON(&request); err != nil {
		c.AbortWithError(http.StatusBadRequest, errors.New("command is required"))
		return
	}

	cmdParts := parseCommand(request.Command)
	if len(cmdParts) == 0 {
		c.AbortWithError(http.StatusBadRequest, errors.New("empty command"))
		return
	}

	cmd := exec.Command(cmdParts[0], cmdParts[1:]...)
	if request.Cwd != nil {
		cmd.Dir = *request.Cwd
	}

	// Create a new process group so we can kill all child processes on timeout
	cmd.SysProcAttr = &syscall.SysProcAttr{
		Setpgid: true,
	}

	var output []byte
	var stdout, stderr bytes.Buffer
	cmd.Stdout = &stdout
	cmd.Stderr = &stderr

	// Start the command
	if err := cmd.Start(); err != nil {
		c.AbortWithError(http.StatusInternalServerError, err)
		return
	}

	pid := cmd.Process.Pid
	log.Debugf("[process/execute] Started command PID=%d: %s", pid, request.Command)

	// Register this PID to prevent zombie reaper from racing with cmd.Wait()
	registry.Register(pid)
	defer func() {
		registry.Unregister(pid)
		log.Debugf("[process/execute] Unregistered PID=%d", pid)
	}()

	// set maximum execution time
	timeout := 360 * time.Second
	if request.Timeout != nil && *request.Timeout > 0 {
		timeout = time.Duration(*request.Timeout) * time.Second
	}

	timeoutReached := false
	timer := time.AfterFunc(timeout, func() {
		timeoutReached = true
		if cmd.Process != nil {
			// Kill the entire process group (negative PID kills the whole group).
			pgid := cmd.Process.Pid
			err := syscall.Kill(-pgid, syscall.SIGKILL)
			if err != nil {
				log.Errorf("Failed to kill process group %d: %v", pgid, err)
				return
			}
		}
	})
	defer timer.Stop()

	// Wait for command to complete
	err := cmd.Wait()
	output = append(stdout.Bytes(), stderr.Bytes()...)

	// Determine exit code
	var exitCode int
	if err != nil {
		if timeoutReached {
			c.AbortWithError(http.StatusRequestTimeout, errors.New("command execution timeout"))
			return
		}

		// Check if this is a "child already reaped" error
		if isNoChildProcessError(err) {
			// Process was reaped by zombie reaper, check cache
			if cachedStatus, found := registry.GetCachedExitStatus(pid); found {
				exitCode = cachedStatus.ExitStatus()
				log.Debugf("[process/execute] PID=%d exit code from cache: %d", pid, exitCode)
			} else {
				waitTimeout := getNoChildWaitTimeout()
				if cachedStatus, found := registry.WaitForExitStatus(pid, waitTimeout); found {
					exitCode = cachedStatus.ExitStatus()
					log.Debugf("[process/execute] PID=%d exit code from cache after wait (%s): %d", pid, waitTimeout, exitCode)
				} else {
					log.Warnf("[process/execute] PID=%d was reaped but no cached status found", pid)
					exitCode = -1
				}
			}
		} else if exitError, ok := err.(*exec.ExitError); ok {
			exitCode = exitError.ExitCode()
			log.Debugf("[process/execute] PID=%d exit code from ExitError: %d", pid, exitCode)
		} else {
			log.Warnf("[process/execute] PID=%d unexpected wait error: %v", pid, err)
			exitCode = -1
		}
	} else if cmd.ProcessState != nil {
		exitCode = cmd.ProcessState.ExitCode()
		log.Debugf("[process/execute] PID=%d exit code from ProcessState: %d", pid, exitCode)
	} else {
		log.Warnf("[process/execute] PID=%d ProcessState is nil", pid)
		exitCode = -1
	}

	c.JSON(http.StatusOK, ExecuteResponse{
		ExitCode: exitCode,
		Result:   string(output),
	})
}

func isNoChildProcessError(err error) bool {
	if err == nil {
		return false
	}
	if errors.Is(err, syscall.ECHILD) {
		return true
	}

	// Fallback: keep compatibility with Go/runtime variants.
	switch err.Error() {
	case "waitid: no child processes", "wait: no child processes":
		return true
	default:
		return false
	}
}

func getNoChildWaitTimeout() time.Duration {
	value := strings.TrimSpace(os.Getenv("DECK_EXECUTE_ECHILD_WAIT_MS"))
	if value == "" {
		return 200 * time.Millisecond
	}
	if parsed, err := strconv.Atoi(strings.TrimSpace(value)); err == nil && parsed >= 0 {
		return time.Duration(parsed) * time.Millisecond
	}
	return 1 * time.Second
}

// parseCommand splits a command string properly handling quotes
func parseCommand(command string) []string {
	var args []string
	var current bytes.Buffer
	var inQuotes bool
	var quoteChar rune

	for _, r := range command {
		switch {
		case r == '"' || r == '\'':
			if !inQuotes {
				inQuotes = true
				quoteChar = r
			} else if quoteChar == r {
				inQuotes = false
				quoteChar = 0
			} else {
				current.WriteRune(r)
			}
		case r == ' ' && !inQuotes:
			if current.Len() > 0 {
				args = append(args, current.String())
				current.Reset()
			}
		default:
			current.WriteRune(r)
		}
	}

	if current.Len() > 0 {
		args = append(args, current.String())
	}

	return args
}
