package fs

import (
	"context"

	"github.com/cofy-x/deck/apps/cli/internal/client"
	"github.com/cofy-x/deck/apps/cli/internal/output"
	"github.com/spf13/cobra"
)

// SearchCmd searches for files by name pattern.
var SearchCmd = &cobra.Command{
	Use:   "search <path> <pattern>",
	Short: "Search for files by name pattern",
	Long: `Search for files matching a name pattern (glob).

Examples:
  deck fs search . "*.go"
  deck fs search /tmp "test*"`,
	Args:         cobra.ExactArgs(2),
	SilenceUsage: true,
	RunE: func(cmd *cobra.Command, args []string) error {
		path := args[0]
		pattern := args[1]

		ctx := context.Background()
		result, _, err := client.Client.FileSystemAPI.SearchFiles(ctx).
			Path(path).
			Pattern(pattern).
			Execute()
		if err != nil {
			return err
		}

		return output.Print(result)
	},
}
