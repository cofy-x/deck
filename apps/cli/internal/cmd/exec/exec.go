package exec

import (
	"github.com/spf13/cobra"
)

// ExecCmd is the exec command group.
var ExecCmd = &cobra.Command{
	Use:   "exec",
	Short: "Command execution",
	Long:  "Execute shell commands in the daemon environment",
}

func init() {
	ExecCmd.AddCommand(RunCmd)
}
