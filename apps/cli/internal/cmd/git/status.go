package git

import (
	"context"

	"github.com/cofy-x/deck/apps/cli/internal/client"
	"github.com/cofy-x/deck/apps/cli/internal/output"
	"github.com/spf13/cobra"
)

// StatusCmd gets git repository status.
var StatusCmd = &cobra.Command{
	Use:   "status [path]",
	Short: "Get git repository status",
	Long: `Get the status of a git repository.

Examples:
  deck git status
  deck git status /path/to/repo`,
	Args:         cobra.MaximumNArgs(1),
	SilenceUsage: true,
	RunE: func(cmd *cobra.Command, args []string) error {
		path := "."
		if len(args) > 0 {
			path = args[0]
		}

		ctx := context.Background()
		status, _, err := client.Client.GitAPI.GetStatus(ctx).
			Path(path).
			Execute()
		if err != nil {
			return err
		}

		return output.Print(status)
	},
}
