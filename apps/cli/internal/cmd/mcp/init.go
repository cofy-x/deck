package mcp

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"

	"github.com/cofy-x/deck/apps/cli/internal/cmd/mcp/agents"
	"github.com/spf13/cobra"
)

var InitCmd = &cobra.Command{
	Use:   "init [AGENT_NAME]",
	Short: "Initialize Deck MCP Server with an agent (currently supported: claude, windsurf, cursor)",
	Args:  cobra.ExactArgs(1),
	RunE: func(cmd *cobra.Command, args []string) error {
		homeDir, err := os.UserHomeDir()
		if err != nil {
			return err
		}

		var agentConfigFilePath, mcpLogFilePath string

		switch args[0] {
		case "claude":
			agentConfigFilePath, mcpLogFilePath, err = agents.InitClaude(homeDir)
			if err != nil {
				return err
			}
		case "cursor":
			agentConfigFilePath, mcpLogFilePath, err = agents.InitCursor(homeDir)
			if err != nil {
				return err
			}
		case "windsurf":
			agentConfigFilePath, mcpLogFilePath, err = agents.InitWindsurf(homeDir)
			if err != nil {
				return err
			}
		default:
			return fmt.Errorf("agent name %s is not supported", args[0])
		}

		return injectConfig(agentConfigFilePath, mcpLogFilePath)
	},
}

func injectConfig(agentConfigFilePath, mcpLogFilePath string) error {
	deckMcpConfig, err := getDeckMcpConfig(mcpLogFilePath)
	if err != nil {
		return err
	}

	agentConfig := make(map[string]interface{})
	if agentConfigData, err := os.ReadFile(agentConfigFilePath); err == nil {
		if len(agentConfigData) > 0 {
			if err := json.Unmarshal(agentConfigData, &agentConfig); err != nil {
				return err
			}
		}
		if agentConfig == nil {
			agentConfig = make(map[string]interface{})
		}
	} else if !os.IsNotExist(err) {
		return err
	}

	if err := os.MkdirAll(filepath.Dir(agentConfigFilePath), 0755); err != nil {
		return err
	}

	mcpServers, ok := agentConfig["mcpServers"].(map[string]interface{})
	if !ok || mcpServers == nil {
		mcpServers = make(map[string]interface{})
	}

	mcpServers["deck-mcp"] = deckMcpConfig
	agentConfig["mcpServers"] = mcpServers

	updatedJSON, err := json.MarshalIndent(agentConfig, "", "    ")
	if err != nil {
		return err
	}

	return os.WriteFile(agentConfigFilePath, updatedJSON, 0644)
}
