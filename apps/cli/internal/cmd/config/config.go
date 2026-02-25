package config

import (
	"github.com/spf13/cobra"
)

// ConfigCmd is the config command group.
var ConfigCmd = &cobra.Command{
	Use:   "config",
	Short: "Manage Deck CLI configuration",
	Long:  "Get and set configuration values for the Deck CLI",
}

func init() {
	ConfigCmd.AddCommand(GetCmd)
	ConfigCmd.AddCommand(SetCmd)
}
