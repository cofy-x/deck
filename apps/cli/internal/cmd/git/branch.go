package git

import (
	"context"

	"github.com/cofy-x/deck/apps/cli/internal/client"
	"github.com/cofy-x/deck/apps/cli/internal/output"
	daemon "github.com/cofy-x/deck/packages/client-daemon-go/daemon"
	"github.com/spf13/cobra"
)

// BranchCmd creates a new branch.
var BranchCmd = &cobra.Command{
	Use:   "branch <path> <name>",
	Short: "Create a new branch",
	Long: `Create a new branch in a git repository.

Examples:
  deck git branch . feature-x
  deck git branch /path/to/repo new-feature`,
	Args:         cobra.ExactArgs(2),
	SilenceUsage: true,
	RunE: func(cmd *cobra.Command, args []string) error {
		path := args[0]
		name := args[1]

		req := daemon.GitBranchRequest{
			Path: path,
			Name: name,
		}

		ctx := context.Background()
		result, err := client.Client.GitAPI.CreateBranch(ctx).
			Request(req).
			Execute()
		if err != nil {
			return err
		}

		output.PrintSuccess("Branch created successfully")
		return output.Print(result)
	},
}
