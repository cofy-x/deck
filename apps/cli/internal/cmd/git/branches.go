package git

import (
	"context"

	"github.com/cofy-x/deck/apps/cli/internal/client"
	"github.com/cofy-x/deck/apps/cli/internal/output"
	"github.com/spf13/cobra"
)

// BranchesCmd lists git branches.
var BranchesCmd = &cobra.Command{
	Use:   "branches [path]",
	Short: "List git branches",
	Long: `List all branches in a git repository.

Examples:
  deck git branches
  deck git branches /path/to/repo`,
	Args:         cobra.MaximumNArgs(1),
	SilenceUsage: true,
	RunE: func(cmd *cobra.Command, args []string) error {
		path := "."
		if len(args) > 0 {
			path = args[0]
		}

		ctx := context.Background()
		branches, _, err := client.Client.GitAPI.ListBranches(ctx).
			Path(path).
			Execute()
		if err != nil {
			return err
		}

		return output.Print(branches)
	},
}
