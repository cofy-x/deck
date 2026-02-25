package fs

import (
	"context"

	"github.com/cofy-x/deck/apps/cli/internal/client"
	"github.com/cofy-x/deck/apps/cli/internal/output"
	daemon "github.com/cofy-x/deck/packages/client-daemon-go/daemon"
	"github.com/spf13/cobra"
)

// ReplaceCmd replaces text in files.
var ReplaceCmd = &cobra.Command{
	Use:   "replace <pattern> <replacement> <files...>",
	Short: "Replace text in files",
	Long: `Replace text patterns in multiple files.

Examples:
  deck fs replace "oldtext" "newtext" file1.txt file2.txt
  deck fs replace "TODO" "DONE" ./src/*.js`,
	Args:         cobra.MinimumNArgs(3),
	SilenceUsage: true,
	RunE: func(cmd *cobra.Command, args []string) error {
		pattern := args[0]
		replacement := args[1]
		files := args[2:]

		req := daemon.ReplaceRequest{
			Pattern:  pattern,
			NewValue: replacement,
			Files:    files,
		}

		ctx := context.Background()
		result, _, err := client.Client.FileSystemAPI.ReplaceInFiles(ctx).
			Request(req).
			Execute()
		if err != nil {
			return err
		}

		output.PrintSuccess("Replacement complete")

		return output.Print(result)
	},
}
