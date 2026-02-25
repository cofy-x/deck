package fs

import (
	"context"

	"github.com/cofy-x/deck/apps/cli/internal/client"
	"github.com/cofy-x/deck/apps/cli/internal/output"
	"github.com/spf13/cobra"
)

// LsCmd lists files in a directory.
var LsCmd = &cobra.Command{
	Use:   "ls [path]",
	Short: "List files in directory",
	Long: `List files and directories in the specified path.

Examples:
  deck fs ls
  deck fs ls /tmp
  deck fs ls ./src`,
	Args:         cobra.MaximumNArgs(1),
	SilenceUsage: true,
	RunE: func(cmd *cobra.Command, args []string) error {
		path := "."
		if len(args) > 0 {
			path = args[0]
		}

		ctx := context.Background()
		files, _, err := client.Client.FileSystemAPI.ListFiles(ctx).
			Path(path).
			Execute()
		if err != nil {
			return err
		}

		return output.Print(files)
	},
}
