package git

import (
	"context"

	"github.com/cofy-x/deck/apps/cli/internal/client"
	"github.com/cofy-x/deck/apps/cli/internal/output"
	daemon "github.com/cofy-x/deck/packages/client-daemon-go/daemon"
	"github.com/spf13/cobra"
)

// CheckoutCmd checks out a branch.
var CheckoutCmd = &cobra.Command{
	Use:   "checkout <path> <branch>",
	Short: "Checkout a branch",
	Long: `Checkout a branch in a git repository.

Examples:
  deck git checkout . main
  deck git checkout /path/to/repo develop`,
	Args:         cobra.ExactArgs(2),
	SilenceUsage: true,
	RunE: func(cmd *cobra.Command, args []string) error {
		path := args[0]
		branch := args[1]

		req := daemon.GitCheckoutRequest{
			Path:   path,
			Branch: branch,
		}

		ctx := context.Background()
		result, err := client.Client.GitAPI.CheckoutBranch(ctx).
			Request(req).
			Execute()
		if err != nil {
			return err
		}

		output.PrintSuccess("Branch checked out successfully")
		return output.Print(result)
	},
}
