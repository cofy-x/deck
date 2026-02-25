package common

import (
	"os"
	"path/filepath"
	"strings"
)

var preferredShellPaths = []string{
	"/usr/bin/zsh",
	"/bin/zsh",
	"/usr/local/bin/zsh",
	"/opt/homebrew/bin/zsh",
}

var fallbackShellPaths = []string{
	"/usr/bin/bash",
	"/bin/bash",
	"/bin/sh",
}

var shellsFilePath = "/etc/shells"

var readFileFunc = os.ReadFile
var statFunc = os.Stat

func GetShell() string {
	for _, shellPath := range preferredShellPaths {
		if isExecutable(shellPath) {
			return shellPath
		}
	}

	if shellEnv := os.Getenv("SHELL"); shellEnv != "" && isExecutable(shellEnv) {
		return shellEnv
	}

	shells := readShellsFile(shellsFilePath)
	if len(shells) > 0 {
		for _, shellPath := range preferredShellPaths {
			if containsShell(shells, shellPath) && isExecutable(shellPath) {
				return shellPath
			}
		}

		for _, shellPath := range fallbackShellPaths {
			if containsShell(shells, shellPath) && isExecutable(shellPath) {
				return shellPath
			}
		}

		for _, shellPath := range shells {
			if isExecutable(shellPath) {
				return shellPath
			}
		}
	}

	for _, shellPath := range fallbackShellPaths {
		if isExecutable(shellPath) {
			return shellPath
		}
	}

	return "sh"
}

func readShellsFile(path string) []string {
	data, err := readFileFunc(path)
	if err != nil {
		return nil
	}

	lines := strings.Split(string(data), "\n")
	shells := make([]string, 0, len(lines))
	for _, line := range lines {
		line = strings.TrimSpace(line)
		if line == "" || strings.HasPrefix(line, "#") {
			continue
		}
		shells = append(shells, line)
	}

	return shells
}

func containsShell(shells []string, target string) bool {
	for _, shellPath := range shells {
		if shellPath == target {
			return true
		}
	}
	return false
}

func isExecutable(path string) bool {
	info, err := statFunc(path)
	if err != nil || info.IsDir() {
		return false
	}
	return info.Mode().Perm()&0111 != 0 && filepath.Base(path) != ""
}
