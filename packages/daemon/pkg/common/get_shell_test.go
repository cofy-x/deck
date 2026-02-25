package common

import (
	"os"
	"path/filepath"
	"testing"
)

func TestGetShellPrefersZsh(t *testing.T) {
	tempDir := t.TempDir()
	zshPath := filepath.Join(tempDir, "zsh")
	if err := os.WriteFile(zshPath, []byte("#!/bin/sh\n"), 0755); err != nil {
		t.Fatalf("write zsh: %v", err)
	}

	restore := overrideShellConfig(t, []string{zshPath}, nil, "")
	defer restore()

	os.Unsetenv("SHELL")

	if got := GetShell(); got != zshPath {
		t.Fatalf("expected zsh path, got: %s", got)
	}
}

func TestGetShellUsesEnvWhenNoPreferred(t *testing.T) {
	tempDir := t.TempDir()
	envShell := filepath.Join(tempDir, "envshell")
	if err := os.WriteFile(envShell, []byte("#!/bin/sh\n"), 0755); err != nil {
		t.Fatalf("write env shell: %v", err)
	}

	restore := overrideShellConfig(t, []string{}, nil, "")
	defer restore()

	t.Setenv("SHELL", envShell)

	if got := GetShell(); got != envShell {
		t.Fatalf("expected env shell, got: %s", got)
	}
}

func TestGetShellUsesShellsFile(t *testing.T) {
	tempDir := t.TempDir()
	zshPath := filepath.Join(tempDir, "zsh")
	bashPath := filepath.Join(tempDir, "bash")
	if err := os.WriteFile(zshPath, []byte("#!/bin/sh\n"), 0755); err != nil {
		t.Fatalf("write zsh: %v", err)
	}
	if err := os.WriteFile(bashPath, []byte("#!/bin/sh\n"), 0755); err != nil {
		t.Fatalf("write bash: %v", err)
	}

	shellsFile := filepath.Join(tempDir, "shells")
	shellsContent := "# comment\n" + bashPath + "\n" + zshPath + "\n"
	if err := os.WriteFile(shellsFile, []byte(shellsContent), 0644); err != nil {
		t.Fatalf("write shells file: %v", err)
	}

	restore := overrideShellConfig(t, []string{zshPath}, []string{bashPath}, shellsFile)
	defer restore()

	os.Unsetenv("SHELL")

	if got := GetShell(); got != zshPath {
		t.Fatalf("expected zsh from shells file, got: %s", got)
	}
}

func TestGetShellFallsBackToSh(t *testing.T) {
	restore := overrideShellConfig(t, []string{}, []string{}, "/nonexistent")
	defer restore()

	os.Unsetenv("SHELL")

	if got := GetShell(); got != "sh" {
		t.Fatalf("expected fallback sh, got: %s", got)
	}
}

func overrideShellConfig(t *testing.T, preferred []string, fallback []string, shellsFile string) func() {
	t.Helper()

	prevPreferred := preferredShellPaths
	prevFallback := fallbackShellPaths
	prevShellsFile := shellsFilePath
	prevReadFile := readFileFunc
	prevStat := statFunc

	preferredShellPaths = preferred
	if fallback != nil {
		fallbackShellPaths = fallback
	}
	if shellsFile != "" {
		shellsFilePath = shellsFile
	}
	readFileFunc = os.ReadFile
	statFunc = os.Stat

	return func() {
		preferredShellPaths = prevPreferred
		fallbackShellPaths = prevFallback
		shellsFilePath = prevShellsFile
		readFileFunc = prevReadFile
		statFunc = prevStat
	}
}
