package git

import (
	"github.com/spf13/cobra"
)

// GitCmd is the git command group.
var GitCmd = &cobra.Command{
	Use:   "git",
	Short: "Git repository operations",
	Long:  "Perform git operations in the daemon environment",
}

func init() {
	GitCmd.AddCommand(StatusCmd)
	GitCmd.AddCommand(BranchesCmd)
	GitCmd.AddCommand(AddCmd)
	GitCmd.AddCommand(CommitCmd)
	GitCmd.AddCommand(CloneCmd)
	GitCmd.AddCommand(CheckoutCmd)
	GitCmd.AddCommand(BranchCmd)
	GitCmd.AddCommand(PullCmd)
	GitCmd.AddCommand(PushCmd)
}
