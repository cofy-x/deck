package provider

import (
	"os"
	"path/filepath"

	"github.com/cofy-x/deck/packages/computer-use/api"
	"github.com/cofy-x/deck/packages/core-go/pkg/log"
)

const ChromeProcessName = "google-chrome"

// OpenBrowser dynamically start or switch Chrome
func (c *ComputerUse) OpenBrowser(req *api.BrowserOpenRequest) (*api.Empty, error) {
	c.mu.Lock()

	// 1. If the browser is already running, call the existing logic to kill it first
	if p, exists := c.processes[ChromeProcessName]; exists {
		c.mu.Unlock() // Release the lock to allow stopProcess to execute
		c.stopProcess(p)
		delete(c.processes, ChromeProcessName)
		c.mu.Lock()
	}

	// 2. Prepare the launch parameters
	args := []string{
		// --- Core isolation and performance ---
		"--no-sandbox",            // Essential for container environments
		"--test-type",             // Eliminate the warning banner of "Unsupported command line flags"
		"--disable-dev-shm-usage", // Solves crashes caused by too small /dev/shm in Docker
		"--disable-gpu",           // Improves stability in container environments without a GPU

		// --- Completely silent (interference elimination) ---
		"--no-first-run",             // Skip the welcome interface for the first run
		"--no-default-browser-check", // Skip the welcome interface for the first run
		"--disable-notifications",    // Disable web notification pop-ups
		"--disable-infobars",         // Hide the "Chrome is being controlled by an automation testing software" prompt bar
		"--disable-extensions",       // Disable all plugins to ensure a clean environment
		"--disable-popup-blocking",   // Disable pop-up blocking (sometimes automation needs to open new windows)

		// --- Automation enhancement ---
		"--password-store=basic",       // Use basic password storage to avoid looking for the system keyring in the container
		"--disable-features=Translate", // Disable automatic translation prompt bar
		"--disable-hang-monitor",       // Disable page unresponsive check to prevent popup waiting window
		"--mute-audio",                 // Mute to prevent webpage automatic sound interference

		// --- Interface control ---
		"--start-maximized",      // Maximize to facilitate screenshot alignment coordinates
		"--window-size=1280,720", // Force resolution to ensure consistent coordinates for AI recognition
	}

	if req.Incognito {
		args = append(args, "--incognito")
	}

	if req.RemoteDebug {
		// Open the debugging port, allowing AI to connect via Playwright/Puppeteer
		args = append(args, "--remote-debugging-port=9222", "--remote-debugging-address=0.0.0.0")
	}

	if req.Url != "" {
		args = append(args, req.Url)
	}

	user := os.Getenv("VNC_USER")
	if user == "" {
		user = "deck"
	}
	display := os.Getenv("DISPLAY")
	if display == "" {
		display = ":0"
	}

	// 3. Define the browser process object
	c.processes[ChromeProcessName] = &Process{
		Name:        ChromeProcessName,
		Command:     "/usr/bin/google-chrome",
		Args:        args,
		User:        user,
		Priority:    900,
		AutoRestart: false, // Dynamic tools usually do not automatically restart, it is determined by the task
		Env: map[string]string{
			"DISPLAY": display,
			"HOME":    filepath.Join("/home", user),
			"USER":    user,
		},
		LogFile: filepath.Join(c.configDir, "chrome.log"),
		ErrFile: filepath.Join(c.configDir, "chrome.err"),
	}
	p := c.processes[ChromeProcessName]
	c.mu.Unlock()

	// 4. Asynchronously start
	go c.startProcess(p)

	log.Infof("Browser opened with URL: %s (RemoteDebug: %v)", req.Url, req.RemoteDebug)
	return new(api.Empty), nil
}

// CloseBrowser forcefully closes the browser process and all associated child processes
func (c *ComputerUse) CloseBrowser() (*api.Empty, error) {
	c.mu.RLock()
	p, exists := c.processes[ChromeProcessName]
	c.mu.RUnlock()

	if !exists {
		return new(api.Empty), nil
	}

	c.stopProcess(p)
	log.Info("Browser closed and cleaned up")
	return new(api.Empty), nil
}
