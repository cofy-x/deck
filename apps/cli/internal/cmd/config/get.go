package config

import (
	"fmt"

	"github.com/cofy-x/deck/apps/cli/internal/config"
	"github.com/spf13/cobra"
)

// GetCmd retrieves a configuration value.
var GetCmd = &cobra.Command{
	Use:   "get <key>",
	Short: "Get a configuration value",
	Long: `Get a configuration value.

Available keys:
  daemon-url      - Daemon API base URL
  output-format   - Output format (json, text)
  no-color        - Disable colored output (true/false)`,
	Args:         cobra.ExactArgs(1),
	SilenceUsage: true,
	RunE: func(cmd *cobra.Command, args []string) error {
		key := args[0]

		switch key {
		case "daemon-url":
			fmt.Println(config.GlobalConfig.DaemonURL)
		case "output-format":
			fmt.Println(config.GlobalConfig.OutputFormat)
		case "no-color":
			fmt.Println(config.GlobalConfig.NoColor)
		default:
			return fmt.Errorf("unknown configuration key: %s", key)
		}

		return nil
	},
}
