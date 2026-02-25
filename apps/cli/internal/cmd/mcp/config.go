package mcp

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"runtime"
	"strings"

	"github.com/cofy-x/deck/apps/cli/internal/cmd/mcp/agents"
	"github.com/spf13/cobra"
)

var executablePath = os.Executable
var evalSymlinks = filepath.EvalSymlinks
var userHomeDir = os.UserHomeDir

var ConfigCmd = &cobra.Command{
	Use:   "config",
	Short: "Outputs JSON configuration for Deck MCP Server",
	Args:  cobra.NoArgs,
	RunE: func(cmd *cobra.Command, args []string) error {
		homeDir, err := userHomeDir()
		if err != nil {
			return err
		}

		var mcpLogFilePath string

		switch runtime.GOOS {
		case "darwin":
			mcpLogFilePath = filepath.Join(homeDir, ".deck", agents.MCPLogFileName)
		case "windows":
			appData := os.Getenv("APPDATA")
			if appData == "" {
				return fmt.Errorf("could not resolve APPDATA environment variable")
			}
			mcpLogFilePath = filepath.Join(appData, ".deck", agents.MCPLogFileName)
		case "linux":
			mcpLogFilePath = filepath.Join(homeDir, ".deck", agents.MCPLogFileName)
		default:
			return fmt.Errorf("unsupported OS: %s", runtime.GOOS)
		}

		deckMcpConfig, err := getDeckMcpConfig(mcpLogFilePath)
		if err != nil {
			return err
		}

		mcpConfig := map[string]interface{}{
			"deck-mcp": deckMcpConfig,
		}

		jsonBytes, err := json.MarshalIndent(mcpConfig, "", "  ")
		if err != nil {
			return err
		}

		fmt.Println(string(jsonBytes))

		return nil
	},
}

func getDeckMcpConfig(mcpLogFilePath string) (map[string]interface{}, error) {
	homeDir, err := userHomeDir()
	if err != nil {
		return nil, err
	}
	commandPath := resolveDeckCommand()
	pathEnv := os.Getenv("PATH")
	if pathEnv == "" {
		pathEnv = "/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin:/opt/homebrew/bin"
	}

	// Create deck-mcp config
	deckMcpConfig := map[string]interface{}{
		"command": commandPath,
		"args":    []string{"mcp", "serve"},
		"env": map[string]string{
			"PATH": pathEnv,
			"HOME": homeDir,
		},
		"logFile": mcpLogFilePath,
	}

	if runtime.GOOS == "windows" {
		deckMcpConfig["env"].(map[string]string)["APPDATA"] = os.Getenv("APPDATA")
	}

	return deckMcpConfig, nil
}

func resolveDeckCommand() string {
	commandPath, err := executablePath()
	if err != nil || strings.TrimSpace(commandPath) == "" {
		return "deck"
	}

	if resolvedPath, err := evalSymlinks(commandPath); err == nil && strings.TrimSpace(resolvedPath) != "" {
		return resolvedPath
	}

	return commandPath
}
