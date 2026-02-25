package fs

import (
	"context"

	"github.com/cofy-x/deck/apps/cli/internal/client"
	"github.com/cofy-x/deck/apps/cli/internal/output"
	"github.com/spf13/cobra"
)

// InfoCmd gets file or directory information.
var InfoCmd = &cobra.Command{
	Use:   "info <path>",
	Short: "Get file or directory information",
	Long: `Get detailed information about a file or directory.

Examples:
  deck fs info /tmp
  deck fs info ./package.json`,
	Args:         cobra.ExactArgs(1),
	SilenceUsage: true,
	RunE: func(cmd *cobra.Command, args []string) error {
		path := args[0]

		ctx := context.Background()
		info, _, err := client.Client.FileSystemAPI.GetFileInfo(ctx).
			Path(path).
			Execute()
		if err != nil {
			return err
		}

		return output.Print(info)
	},
}
