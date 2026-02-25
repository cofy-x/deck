package info

import (
	"github.com/spf13/cobra"
)

// InfoCmd is the info command group.
var InfoCmd = &cobra.Command{
	Use:   "info",
	Short: "System and environment information",
	Long:  "Get system and environment information from the daemon",
}

func init() {
	InfoCmd.AddCommand(VersionCmd)
	InfoCmd.AddCommand(WorkdirCmd)
	InfoCmd.AddCommand(HomedirCmd)
	InfoCmd.AddCommand(PortsCmd)
}
