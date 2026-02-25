package fs

import (
	"context"

	"github.com/cofy-x/deck/apps/cli/internal/client"
	"github.com/cofy-x/deck/apps/cli/internal/output"
	"github.com/spf13/cobra"
)

// MvCmd moves or renames a file or directory.
var MvCmd = &cobra.Command{
	Use:   "mv <source> <destination>",
	Short: "Move or rename a file or directory",
	Long: `Move or rename a file or directory.

Examples:
  deck fs mv /tmp/old.txt /tmp/new.txt
  deck fs mv ./src ./source`,
	Args:         cobra.ExactArgs(2),
	SilenceUsage: true,
	RunE: func(cmd *cobra.Command, args []string) error {
		source := args[0]
		destination := args[1]

		ctx := context.Background()
		result, err := client.Client.FileSystemAPI.MoveFile(ctx).
			Source(source).
			Destination(destination).
			Execute()
		if err != nil {
			return err
		}

		output.PrintSuccess("File/directory moved successfully")
		return output.Print(result)
	},
}
