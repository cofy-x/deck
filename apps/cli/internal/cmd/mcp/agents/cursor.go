package agents

import (
	"errors"
	"os"
	"path/filepath"
	"runtime"
)

func InitCursor(homeDir string) (string, string, error) {
	var agentConfigFilePath string
	var mcpLogFilePath string

	switch runtime.GOOS {
	case "darwin":
		agentConfigFilePath = filepath.Join(homeDir, ".cursor", "mcp.json")
		mcpLogFilePath = filepath.Join(homeDir, "Library", "Logs", "Cursor", MCPLogFileName)

	case "windows":
		// Resolve %APPDATA% environment variable
		appData := os.Getenv("APPDATA")
		if appData == "" {
			return "", "", errors.New("could not resolve APPDATA environment variable")
		}

		agentConfigFilePath = filepath.Join(appData, ".cursor", "mcp.json")
		mcpLogFilePath = filepath.Join(appData, "Cursor", "Logs", MCPLogFileName)

	case "linux":
		agentConfigFilePath = filepath.Join(homeDir, ".cursor", "mcp.json")
		mcpLogFilePath = filepath.Join("/", "var", "log", "Cursor", MCPLogFileName)
	default:
		return "", "", errors.New("operating system is not supported")
	}

	return agentConfigFilePath, mcpLogFilePath, nil
}
