package git

import (
	"context"

	"github.com/cofy-x/deck/apps/cli/internal/client"
	"github.com/cofy-x/deck/apps/cli/internal/output"
	daemon "github.com/cofy-x/deck/packages/client-daemon-go/daemon"
	"github.com/spf13/cobra"
)

// AddCmd stages files for commit.
var AddCmd = &cobra.Command{
	Use:   "add <path> <files...>",
	Short: "Stage files for commit",
	Long: `Stage files for commit in a git repository.

Examples:
  deck git add . file1.txt file2.txt
  deck git add /path/to/repo *.go`,
	Args:         cobra.MinimumNArgs(2),
	SilenceUsage: true,
	RunE: func(cmd *cobra.Command, args []string) error {
		path := args[0]
		files := args[1:]

		req := daemon.GitAddRequest{
			Path:  path,
			Files: files,
		}

		ctx := context.Background()
		result, err := client.Client.GitAPI.AddFiles(ctx).
			Request(req).
			Execute()
		if err != nil {
			return err
		}

		output.PrintSuccess("Files staged successfully")
		return output.Print(result)
	},
}
