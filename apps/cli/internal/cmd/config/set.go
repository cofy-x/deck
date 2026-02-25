package config

import (
	"fmt"
	"strconv"

	"github.com/cofy-x/deck/apps/cli/internal/config"
	"github.com/cofy-x/deck/apps/cli/internal/output"
	"github.com/spf13/cobra"
)

// SetCmd sets a configuration value.
var SetCmd = &cobra.Command{
	Use:   "set <key> <value>",
	Short: "Set a configuration value",
	Long: `Set a configuration value and save it to the config file.

Available keys:
  daemon-url      - Daemon API base URL
  output-format   - Output format (json, text)
  no-color        - Disable colored output (true/false)`,
	Args:         cobra.ExactArgs(2),
	SilenceUsage: true,
	RunE: func(cmd *cobra.Command, args []string) error {
		key := args[0]
		value := args[1]

		switch key {
		case "daemon-url":
			config.GlobalConfig.DaemonURL = value
		case "output-format":
			if !config.IsValidOutputFormat(value) {
				return fmt.Errorf("invalid output format: %s (must be json or text)", value)
			}
			config.GlobalConfig.OutputFormat = value
		case "no-color":
			noColor, err := strconv.ParseBool(value)
			if err != nil {
				return fmt.Errorf("invalid value for no-color: %s (must be true or false)", value)
			}
			config.GlobalConfig.NoColor = noColor
		default:
			return fmt.Errorf("unknown configuration key: %s", key)
		}

		if err := config.Save(); err != nil {
			return fmt.Errorf("failed to save configuration: %w", err)
		}

		output.PrintSuccess(fmt.Sprintf("Set %s = %s", key, value))
		return nil
	},
}
