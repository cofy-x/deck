package git

import (
	"context"

	"github.com/cofy-x/deck/apps/cli/internal/client"
	"github.com/cofy-x/deck/apps/cli/internal/output"
	daemon "github.com/cofy-x/deck/packages/client-daemon-go/daemon"
	"github.com/spf13/cobra"
)

// PullCmd pulls changes from remote.
var PullCmd = &cobra.Command{
	Use:   "pull <path>",
	Short: "Pull changes from remote",
	Long: `Pull changes from the remote repository.

Examples:
  deck git pull .
  deck git pull /path/to/repo`,
	Args:         cobra.ExactArgs(1),
	SilenceUsage: true,
	RunE: func(cmd *cobra.Command, args []string) error {
		path := args[0]

		req := daemon.GitRepoRequest{
			Path: path,
		}

		ctx := context.Background()
		result, err := client.Client.GitAPI.PullChanges(ctx).
			Request(req).
			Execute()
		if err != nil {
			return err
		}

		output.PrintSuccess("Changes pulled successfully")
		return output.Print(result)
	},
}
