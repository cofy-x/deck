package fs

import (
	"context"

	"github.com/cofy-x/deck/apps/cli/internal/client"
	"github.com/cofy-x/deck/apps/cli/internal/output"
	"github.com/spf13/cobra"
)

// MkdirCmd creates a directory.
var MkdirCmd = &cobra.Command{
	Use:   "mkdir <path>",
	Short: "Create a directory",
	Long: `Create a directory at the specified path.

Examples:
  deck fs mkdir /tmp/newdir
  deck fs mkdir ./test`,
	Args:         cobra.ExactArgs(1),
	SilenceUsage: true,
	RunE: func(cmd *cobra.Command, args []string) error {
		path := args[0]

		ctx := context.Background()
		req := client.Client.FileSystemAPI.CreateFolder(ctx).Path(path).Mode("0755")

		result, err := req.Execute()
		if err != nil {
			return err
		}

		output.PrintSuccess("Directory created successfully")
		return output.Print(result)
	},
}
