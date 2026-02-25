package agents

import (
	"errors"
	"os"
	"path/filepath"
	"runtime"
)

func InitWindsurf(homeDir string) (string, string, error) {
	var agentConfigFilePath string
	var mcpLogFilePath string

	switch runtime.GOOS {
	case "darwin":
		agentConfigFilePath = filepath.Join(homeDir, ".codeium", "windsurf", "mcp_config.json")
		mcpLogFilePath = filepath.Join(homeDir, "Library", "Logs", "Windsurf", MCPLogFileName)

	case "windows":
		// Resolve %APPDATA% environment variable
		appData := os.Getenv("APPDATA")
		if appData == "" {
			return "", "", errors.New("could not resolve APPDATA environment variable")
		}

		agentConfigFilePath = filepath.Join(appData, ".codeium", "windsurf", "mcp_config.json")
		mcpLogFilePath = filepath.Join(appData, "Windsurf", "Logs", MCPLogFileName)

	case "linux":
		agentConfigFilePath = filepath.Join(homeDir, ".codeium", "windsurf", "mcp_config.json")
		mcpLogFilePath = filepath.Join("/", "var", "log", "Windsurf", MCPLogFileName)
	default:
		return "", "", errors.New("operating system is not supported")
	}

	return agentConfigFilePath, mcpLogFilePath, nil
}
