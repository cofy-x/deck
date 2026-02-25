package exec

import (
	"context"
	"fmt"

	"github.com/cofy-x/deck/apps/cli/internal/client"
	"github.com/cofy-x/deck/apps/cli/internal/output"
	daemon "github.com/cofy-x/deck/packages/client-daemon-go/daemon"
	"github.com/spf13/cobra"
)

var (
	cmdCwd     string
	cmdTimeout int32
)

// RunCmd executes a shell command.
var RunCmd = &cobra.Command{
	Use:   "run <command>",
	Short: "Execute a shell command",
	Long: `Execute a shell command in the daemon environment.

Examples:
  deck exec run "ls -la"
  deck exec run "pwd" --cwd=/tmp
  deck exec run "sleep 10" --timeout=30`,
	Args:         cobra.ExactArgs(1),
	SilenceUsage: true,
	RunE: func(cmd *cobra.Command, args []string) error {
		command := args[0]

		req := daemon.NewExecuteRequest(command)
		if cmdCwd != "" {
			req.SetCwd(cmdCwd)
		}
		if cmdTimeout > 0 {
			req.SetTimeout(cmdTimeout)
		}

		ctx := context.Background()
		result, _, err := client.Client.ProcessAPI.ExecuteCommand(ctx).
			Request(*req).
			Execute()
		if err != nil {
			return err
		}

		// Print the result directly (not as JSON)
		fmt.Println(result.GetResult())

		// If exit code is non-zero, also show it
		if result.GetExitCode() != 0 {
			output.PrintWarning(fmt.Sprintf("Exit code: %d", result.GetExitCode()))
		}

		return nil
	},
}

func init() {
	RunCmd.Flags().StringVar(&cmdCwd, "cwd", "", "Working directory")
	RunCmd.Flags().Int32Var(&cmdTimeout, "timeout", 0, "Timeout in seconds")
}
