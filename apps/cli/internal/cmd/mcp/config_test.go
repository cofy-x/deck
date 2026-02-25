package mcp

import (
	"os"
	"path/filepath"
	"testing"
)

func TestResolveDeckCommandUsesResolvedExecutablePath(t *testing.T) {
	originalExecutablePath := executablePath
	originalEvalSymlinks := evalSymlinks
	t.Cleanup(func() {
		executablePath = originalExecutablePath
		evalSymlinks = originalEvalSymlinks
	})

	executablePath = func() (string, error) {
		return "/tmp/deck-link", nil
	}
	evalSymlinks = func(path string) (string, error) {
		if path != "/tmp/deck-link" {
			t.Fatalf("unexpected path passed to evalSymlinks: %q", path)
		}
		return "/opt/deck/bin/deck", nil
	}

	if got := resolveDeckCommand(); got != "/opt/deck/bin/deck" {
		t.Fatalf("resolveDeckCommand() = %q, want %q", got, "/opt/deck/bin/deck")
	}
}

func TestResolveDeckCommandFallsBackToDeckOnError(t *testing.T) {
	originalExecutablePath := executablePath
	t.Cleanup(func() { executablePath = originalExecutablePath })

	executablePath = func() (string, error) {
		return "", os.ErrNotExist
	}

	if got := resolveDeckCommand(); got != "deck" {
		t.Fatalf("resolveDeckCommand() = %q, want %q", got, "deck")
	}
}

func TestGetDeckMcpConfigUsesResolvedCommand(t *testing.T) {
	originalUserHomeDir := userHomeDir
	originalExecutablePath := executablePath
	originalEvalSymlinks := evalSymlinks
	t.Cleanup(func() {
		userHomeDir = originalUserHomeDir
		executablePath = originalExecutablePath
		evalSymlinks = originalEvalSymlinks
	})

	userHomeDir = func() (string, error) {
		return "/home/tester", nil
	}
	executablePath = func() (string, error) {
		return "/usr/local/bin/deck", nil
	}
	evalSymlinks = func(path string) (string, error) {
		return path, nil
	}

	cfg, err := getDeckMcpConfig(filepath.Join("/tmp", "deck.log"))
	if err != nil {
		t.Fatalf("getDeckMcpConfig() error = %v", err)
	}

	command, ok := cfg["command"].(string)
	if !ok {
		t.Fatalf("command type = %T, want string", cfg["command"])
	}
	if command != "/usr/local/bin/deck" {
		t.Fatalf("command = %q, want %q", command, "/usr/local/bin/deck")
	}
}
