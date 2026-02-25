package session

import (
	"github.com/spf13/cobra"
)

// SessionCmd is the session command group.
var SessionCmd = &cobra.Command{
	Use:   "session",
	Short: "Session management for interactive commands",
	Long:  "Create and manage interactive command sessions in the daemon environment",
}

func init() {
	SessionCmd.AddCommand(CreateCmd)
	SessionCmd.AddCommand(ExecCmd)
	SessionCmd.AddCommand(ListCmd)
	SessionCmd.AddCommand(DeleteCmd)
}
