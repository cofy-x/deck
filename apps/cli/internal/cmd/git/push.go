package git

import (
	"context"

	"github.com/cofy-x/deck/apps/cli/internal/client"
	"github.com/cofy-x/deck/apps/cli/internal/output"
	daemon "github.com/cofy-x/deck/packages/client-daemon-go/daemon"
	"github.com/spf13/cobra"
)

// PushCmd pushes changes to remote.
var PushCmd = &cobra.Command{
	Use:   "push <path>",
	Short: "Push changes to remote",
	Long: `Push changes to the remote repository.

Examples:
  deck git push .
  deck git push /path/to/repo`,
	Args:         cobra.ExactArgs(1),
	SilenceUsage: true,
	RunE: func(cmd *cobra.Command, args []string) error {
		path := args[0]

		req := daemon.GitRepoRequest{
			Path: path,
		}

		ctx := context.Background()
		result, err := client.Client.GitAPI.PushChanges(ctx).
			Request(req).
			Execute()
		if err != nil {
			return err
		}

		output.PrintSuccess("Changes pushed successfully")
		return output.Print(result)
	},
}
