package provider

import (
	"context"
	"fmt"
	"os"
	"os/exec"
	"os/signal"
	"os/user"
	"path/filepath"
	"strconv"
	"sync"
	"syscall"
	"time"

	"github.com/cofy-x/deck/packages/computer-use/api"
	"github.com/cofy-x/deck/packages/core-go/pkg/log"
)

const FixedDbusAddress = "unix:path=/var/run/dbus/user_bus_socket"

type Process struct {
	Name        string
	Command     string
	Args        []string
	User        string
	Priority    int
	Env         map[string]string
	LogFile     string
	ErrFile     string
	AutoRestart bool
	cmd         *exec.Cmd
	ctx         context.Context
	cancel      context.CancelFunc
	mu          sync.Mutex
	running     bool
}

type ComputerUse struct {
	processes map[string]*Process
	mu        sync.RWMutex
	configDir string
}

var _ api.IComputerUse = &ComputerUse{}

func (c *ComputerUse) Initialize() (*api.Empty, error) {
	c.processes = make(map[string]*Process)
	homeDir, err := os.UserHomeDir()
	if err != nil {
		return new(api.Empty), fmt.Errorf("failed to get home directory: %v", err)
	}
	c.configDir = filepath.Join(homeDir, ".deck", "computeruse")
	_ = os.MkdirAll(c.configDir, 0755)

	// 1. Force set global D-Bus environment variable
	os.Setenv("DBUS_SESSION_BUS_ADDRESS", FixedDbusAddress)
	os.Setenv("DBUS_SYSTEM_BUS_ADDRESS", FixedDbusAddress)

	// 2. Pre-create D-Bus directory and set permissions (if running as root)
	_ = os.MkdirAll("/var/run/dbus", 0755)
	if os.Getuid() == 0 {
		if u, err := user.Lookup(os.Getenv("VNC_USER")); err == nil {
			uid, _ := strconv.Atoi(u.Uid)
			gid, _ := strconv.Atoi(u.Gid)
			_ = os.Chown("/var/run/dbus", uid, gid)
		}
	}

	// 3. Start permanent D-Bus daemon, instead of using dbus-launch
	go func() {
		log.Info("Starting permanent D-Bus daemon...")
		dbusCmd := exec.Command("dbus-daemon", "--session", "--address="+FixedDbusAddress, "--nofork", "--nopidfile")
		if err := dbusCmd.Run(); err != nil {
			log.Errorf("D-Bus daemon exited: %v", err)
		}
	}()

	// Wait for D-Bus socket to be ready (2 seconds)
	for range 20 {
		if _, err := os.Stat("/var/run/dbus/user_bus_socket"); err == nil {
			log.Info("D-Bus socket is ready.")
			break
		}
		time.Sleep(100 * time.Millisecond)
	}

	c.initializeProcesses(homeDir)
	return new(api.Empty), nil
}

func (c *ComputerUse) Start() (*api.Empty, error) {
	// Set DISPLAY environment variable in the main process
	display := os.Getenv("DISPLAY")
	if display == "" {
		display = ":0"
	}
	os.Setenv("DISPLAY", display)
	log.Infof("Set DISPLAY environment variable to: %s", display)

	// Start all processes in order of priority
	c.startAllProcesses()

	// Check process status after starting
	status, err := c.GetProcessStatus()
	if err != nil {
		return nil, fmt.Errorf("failed to get process status after start: %v", err)
	}

	// Check if all required processes are running
	required := []string{"xvfb", "xfce4", "x11vnc", "novnc"}
	var failed []string
	for _, name := range required {
		if s, ok := status[name]; !ok || !s.Running {
			failed = append(failed, name)
		}
	}

	if len(failed) > 0 {
		return nil, fmt.Errorf("failed to start: %v", failed)
	}

	return new(api.Empty), nil
}

func (c *ComputerUse) initializeProcesses(homeDir string) {
	// Get environment variables from Dockerfile or use defaults
	vncResolution := os.Getenv("VNC_RESOLUTION")
	if vncResolution == "" {
		vncResolution = "1280x720"
	}

	vncPort := os.Getenv("VNC_PORT")
	if vncPort == "" {
		vncPort = "5901"
	}

	noVncPort := os.Getenv("NO_VNC_PORT")
	if noVncPort == "" {
		noVncPort = "6080"
	}

	display := os.Getenv("DISPLAY")
	if display == "" {
		display = ":0"
	}

	// Get user from environment, fallback to DECK_SANDBOX_USER or default to "deck"
	user := os.Getenv("VNC_USER")
	if user == "" {
		user = os.Getenv("DECK_SANDBOX_USER")
		if user == "" {
			user = "deck"
		}
	}

	// Process 1: Xvfb (X Virtual Framebuffer)
	c.processes["xvfb"] = &Process{
		Name:        "xvfb",
		Command:     "/usr/bin/Xvfb",
		Args:        []string{display, "-screen", "0", vncResolution + "x24"},
		User:        user,
		Priority:    100,
		AutoRestart: true,
		Env: map[string]string{
			"DISPLAY": display,
		},
		LogFile: filepath.Join(c.configDir, "xvfb.log"),
		ErrFile: filepath.Join(c.configDir, "xvfb.err"),
	}

	// Process 2: xfce4 (Desktop Environment)
	c.processes["xfce4"] = &Process{
		Name:        "xfce4",
		Command:     "/usr/bin/startxfce4",
		Args:        []string{},
		User:        user,
		Priority:    200,
		AutoRestart: true,
		Env: map[string]string{
			"DISPLAY":         display,
			"HOME":            homeDir,
			"USER":            user,
			"XDG_RUNTIME_DIR": fmt.Sprintf("/tmp/runtime-%s", user),
		},
		LogFile: filepath.Join(c.configDir, "xfce4.log"),
		ErrFile: filepath.Join(c.configDir, "xfce4.err"),
	}

	// Process 3: x11vnc (VNC Server)
	c.processes["x11vnc"] = &Process{
		Name:        "x11vnc",
		Command:     "/usr/bin/x11vnc",
		Args:        []string{"-display", display, "-forever", "-shared", "-rfbport", vncPort},
		User:        user,
		Priority:    300,
		AutoRestart: true,
		Env: map[string]string{
			"DISPLAY": display,
		},
		LogFile: filepath.Join(c.configDir, "x11vnc.log"),
		ErrFile: filepath.Join(c.configDir, "x11vnc.err"),
	}

	// Process 4: novnc (Web-based VNC client)
	// Determine the best available NoVNC command with fallback options
	var novncCommand string
	var novncArgs []string

	// Priority 1: Try launch.sh (modern NoVNC with enhanced features)
	if _, err := os.Stat("/usr/share/novnc/utils/launch.sh"); err == nil {
		novncCommand = "/usr/share/novnc/utils/launch.sh"
		novncArgs = []string{"--vnc", "localhost:" + vncPort, "--listen", noVncPort}
		log.Infof("Using NoVNC launch.sh (recommended)")
	} else if _, err := os.Stat("/usr/share/novnc/utils/novnc_proxy"); err == nil {
		// Priority 2: Try novnc_proxy (legacy NoVNC script)
		novncCommand = "/usr/share/novnc/utils/novnc_proxy"
		novncArgs = []string{"--vnc", "localhost:" + vncPort, "--listen", noVncPort}
		log.Infof("Using NoVNC novnc_proxy (legacy)")
	} else {
		// Priority 3: Fallback to direct websockify (always available)
		novncCommand = "websockify"
		novncArgs = []string{"--web=/usr/share/novnc/", noVncPort, "localhost:" + vncPort}
		log.Infof("Using direct websockify (fallback)")
	}

	c.processes["novnc"] = &Process{
		Name:        "novnc",
		Command:     novncCommand,
		Args:        novncArgs,
		User:        user,
		Priority:    400,
		AutoRestart: true,
		Env: map[string]string{
			"DISPLAY": display,
		},
		LogFile: filepath.Join(c.configDir, "novnc.log"),
		ErrFile: filepath.Join(c.configDir, "novnc.err"),
	}
}

func (c *ComputerUse) startAllProcesses() {
	// Sort processes by priority and start them
	processes := c.getProcessesByPriority()

	for _, process := range processes {
		go c.startProcess(process)
		// Wait a bit between starting processes to ensure proper initialization
		time.Sleep(2 * time.Second)
	}
}

func (c *ComputerUse) getProcessesByPriority() []*Process {
	c.mu.RLock()
	defer c.mu.RUnlock()

	var processes []*Process
	for _, p := range c.processes {
		processes = append(processes, p)
	}

	// Sort by priority (lower number = higher priority)
	for i := 0; i < len(processes)-1; i++ {
		for j := i + 1; j < len(processes); j++ {
			if processes[i].Priority > processes[j].Priority {
				processes[i], processes[j] = processes[j], processes[i]
			}
		}
	}

	return processes
}

func (c *ComputerUse) startProcess(process *Process) {
	process.mu.Lock()
	if process.running {
		process.mu.Unlock()
		return
	}
	process.running = true
	process.mu.Unlock()

	for {
		log.Infof("Starting process: %s", process.Name)

		// Create context for the process
		process.ctx, process.cancel = context.WithCancel(context.Background())

		// Create command
		process.cmd = exec.CommandContext(process.ctx, process.Command, process.Args...)

		// Environment Variable Injection
		fullEnv := os.Environ()
		for k, v := range process.Env {
			fullEnv = append(fullEnv, fmt.Sprintf("%s=%s", k, v))
		}
		// Force inject fixed D-Bus address, override any potential drift
		fullEnv = append(fullEnv, "DBUS_SESSION_BUS_ADDRESS="+FixedDbusAddress)
		process.cmd.Env = fullEnv

		// Process Group and Privilege Switching
		sysAttr := &syscall.SysProcAttr{
			Setpgid: true, // Create process group, for easy killing of child processes
		}

		// If current is root but configured for a normal user, execute privilege drop
		if os.Getuid() == 0 && process.User != "" && process.User != "root" {
			if u, err := user.Lookup(process.User); err == nil {
				uid, _ := strconv.Atoi(u.Uid)
				gid, _ := strconv.Atoi(u.Gid)
				sysAttr.Credential = &syscall.Credential{Uid: uint32(uid), Gid: uint32(gid)}
				log.Infof("Process %s will run as user: %s (uid:%d)", process.Name, process.User, uid)
			}
		}
		process.cmd.SysProcAttr = sysAttr

		// Log Handling
		if f, err := os.OpenFile(process.LogFile, os.O_CREATE|os.O_WRONLY|os.O_APPEND, 0644); err == nil {
			process.cmd.Stdout = f
			defer f.Close()
		}
		if f, err := os.OpenFile(process.ErrFile, os.O_CREATE|os.O_WRONLY|os.O_APPEND, 0644); err == nil {
			process.cmd.Stderr = f
			defer f.Close()
		}

		if err := process.cmd.Start(); err != nil {
			log.Errorf("Failed to start %s: %v", process.Name, err)
		} else {
			process.cmd.Wait()
		}

		if !process.AutoRestart {
			break
		}
		time.Sleep(2 * time.Second)
	}

	process.mu.Lock()
	process.running = false
	process.mu.Unlock()
}

func (c *ComputerUse) Stop() (*api.Empty, error) {
	log.Info("Stopping all computer use processes...")

	c.mu.RLock()
	processes := make([]*Process, 0, len(c.processes))
	for _, p := range c.processes {
		processes = append(processes, p)
	}
	c.mu.RUnlock()

	// Stop processes in reverse priority order
	for i := len(processes) - 1; i >= 0; i-- {
		process := processes[i]
		c.stopProcess(process)
	}

	return new(api.Empty), nil
}

func (c *ComputerUse) stopProcess(process *Process) {
	process.mu.Lock()
	defer process.mu.Unlock()

	if !process.running || process.cmd == nil || process.cmd.Process == nil {
		return
	}

	log.Infof("Stopping process group for: %s", process.Name)

	// --- 核心修复：杀死整个进程组 ---
	// 使用负值的 PID 会将信号发送给整个进程组 (PGID)
	pgid, err := syscall.Getpgid(process.cmd.Process.Pid)
	if err == nil {
		_ = syscall.Kill(-pgid, syscall.SIGKILL)
	} else {
		_ = process.cmd.Process.Kill()
	}

	if process.cancel != nil {
		process.cancel()
	}
	process.running = false
}

func (c *ComputerUse) GetProcessStatus() (map[string]api.ProcessStatus, error) {
	c.mu.RLock()
	defer c.mu.RUnlock()

	status := make(map[string]api.ProcessStatus)
	for name, process := range c.processes {
		process.mu.Lock()
		processStatus := api.ProcessStatus{
			Running:     false,
			Priority:    process.Priority,
			AutoRestart: process.AutoRestart,
		}

		if process.cmd != nil && process.cmd.Process != nil {
			// Check if the process is still alive
			if err := process.cmd.Process.Signal(syscall.Signal(0)); err == nil {
				processStatus.Running = true
				processStatus.Pid = &process.cmd.Process.Pid
			}
		}

		process.mu.Unlock()
		status[name] = processStatus
	}

	return status, nil
}

// IsProcessRunning checks if a specific process is running
func (c *ComputerUse) IsProcessRunning(req *api.ProcessRequest) (bool, error) {
	c.mu.RLock()
	defer c.mu.RUnlock()

	process, exists := c.processes[req.ProcessName]
	if !exists {
		return false, fmt.Errorf("process %s not found", req.ProcessName)
	}

	process.mu.Lock()
	defer process.mu.Unlock()
	return process.running, nil
}

// RestartProcess restarts a specific process
func (c *ComputerUse) RestartProcess(req *api.ProcessRequest) (*api.Empty, error) {
	c.mu.RLock()
	process, exists := c.processes[req.ProcessName]
	c.mu.RUnlock()

	if !exists {
		return nil, fmt.Errorf("process %s not found", req.ProcessName)
	}

	// Stop the process first
	c.stopProcess(process)

	// Wait a moment for cleanup
	time.Sleep(1 * time.Second)

	// Start the process again
	go c.startProcess(process)

	return new(api.Empty), nil
}

// GetProcessLogs returns the logs for a specific process
func (c *ComputerUse) GetProcessLogs(req *api.ProcessRequest) (string, error) {
	c.mu.RLock()
	process, exists := c.processes[req.ProcessName]
	c.mu.RUnlock()

	if !exists {
		return "", fmt.Errorf("process %s not found", req.ProcessName)
	}

	if process.LogFile == "" {
		return "", fmt.Errorf("no log file configured for process %s", req.ProcessName)
	}

	content, err := os.ReadFile(process.LogFile)
	if err != nil {
		return "", fmt.Errorf("failed to read log file for %s: %v", req.ProcessName, err)
	}

	return string(content), nil
}

// GetProcessErrors returns the error logs for a specific process
func (c *ComputerUse) GetProcessErrors(req *api.ProcessRequest) (string, error) {
	c.mu.RLock()
	process, exists := c.processes[req.ProcessName]
	c.mu.RUnlock()

	if !exists {
		return "", fmt.Errorf("process %s not found", req.ProcessName)
	}

	if process.ErrFile == "" {
		return "", fmt.Errorf("no error file configured for process %s", req.ProcessName)
	}

	content, err := os.ReadFile(process.ErrFile)
	if err != nil {
		return "", fmt.Errorf("failed to read error file for %s: %v", req.ProcessName, err)
	}

	return string(content), nil
}

func (c *ComputerUse) GetStatus() (*api.ComputerUseStatusResponse, error) {
	// Get the current process status
	processStatus, err := c.GetProcessStatus()
	if err != nil {
		return &api.ComputerUseStatusResponse{
			Status: "error",
		}, err
	}

	// Check if all required processes are running
	requiredProcesses := []string{"xvfb", "xfce4", "x11vnc", "novnc"}
	allRunning := true

	for _, processName := range requiredProcesses {
		if status, exists := processStatus[processName]; !exists || !status.Running {
			allRunning = false
			break
		}
	}

	if allRunning {
		return &api.ComputerUseStatusResponse{
			Status: "active",
		}, nil
	}

	// Check if any processes are running
	anyRunning := false
	for _, status := range processStatus {
		if status.Running {
			anyRunning = true
			break
		}
	}

	if anyRunning {
		return &api.ComputerUseStatusResponse{
			Status: "partial",
		}, nil
	}

	return &api.ComputerUseStatusResponse{
		Status: "inactive",
	}, nil
}

func (c *ComputerUse) HandleSystemSignals() {
	// Add buffer to prevent signal loss when multiple processes exit at once
	sigCh := make(chan os.Signal, 10)
	// Listen for SIGTERM (docker stop) and SIGINT (Ctrl+C)
	signal.Notify(sigCh, syscall.SIGTERM, syscall.SIGINT)

	go func() {
		sig := <-sigCh
		log.Infof("Received signal [%v]. Starting graceful shutdown...", sig)

		// 1. Set timeout protection to prevent Stop() from getting stuck and causing the container to not close
		shutdownCtx, cancel := context.WithTimeout(context.Background(), 8*time.Second)
		defer cancel()

		done := make(chan struct{})
		go func() {
			c.Stop() // Execute the logic to stop all child processes
			close(done)
		}()

		select {
		case <-done:
			log.Info("All child processes stopped gracefully.")
		case <-shutdownCtx.Done():
			log.Warn("Shutdown timed out, forcing exit.")
		}

		log.Info("Deck daemon exiting. Goodbye.")
		os.Exit(0)
	}()
}
