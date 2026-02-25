package fs

import (
	"context"

	"github.com/cofy-x/deck/apps/cli/internal/client"
	"github.com/cofy-x/deck/apps/cli/internal/interactive"
	"github.com/cofy-x/deck/apps/cli/internal/output"
	"github.com/spf13/cobra"
)

var (
	rmRecursive bool
	rmForce     bool
)

// RmCmd removes a file or directory.
var RmCmd = &cobra.Command{
	Use:   "rm <path>",
	Short: "Remove a file or directory",
	Long: `Remove a file or directory.

Examples:
  deck fs rm /tmp/file.txt
  deck fs rm ./test -r`,
	Args:         cobra.ExactArgs(1),
	SilenceUsage: true,
	RunE: func(cmd *cobra.Command, args []string) error {
		path := args[0]

		// Confirm deletion if recursive and not forced
		if rmRecursive && !rmForce {
			confirmed, err := interactive.Confirm("Are you sure you want to delete this directory recursively?", false)
			if err != nil {
				return err
			}
			if !confirmed {
				output.PrintInfo("Operation cancelled")
				return nil
			}
		}

		ctx := context.Background()
		result, err := client.Client.FileSystemAPI.DeleteFile(ctx).
			Path(path).
			Recursive(rmRecursive).
			Execute()
		if err != nil {
			return err
		}

		output.PrintSuccess("File/directory deleted successfully")
		return output.Print(result)
	},
}

func init() {
	RmCmd.Flags().BoolVarP(&rmRecursive, "recursive", "r", false, "Remove directories and their contents recursively")
	RmCmd.Flags().BoolVarP(&rmForce, "force", "f", false, "Force deletion without confirmation")
}
