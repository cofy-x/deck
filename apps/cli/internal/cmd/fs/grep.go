package fs

import (
	"context"

	"github.com/cofy-x/deck/apps/cli/internal/client"
	"github.com/cofy-x/deck/apps/cli/internal/output"
	"github.com/spf13/cobra"
)

// GrepCmd searches for content within files.
var GrepCmd = &cobra.Command{
	Use:   "grep <path> <pattern>",
	Short: "Search for content within files",
	Long: `Search for text patterns within files.

Examples:
  deck fs grep . "TODO"
  deck fs grep /tmp "error"`,
	Args:         cobra.ExactArgs(2),
	SilenceUsage: true,
	RunE: func(cmd *cobra.Command, args []string) error {
		path := args[0]
		pattern := args[1]

		ctx := context.Background()
		result, _, err := client.Client.FileSystemAPI.FindInFiles(ctx).
			Path(path).
			Pattern(pattern).
			Execute()
		if err != nil {
			return err
		}

		return output.Print(result)
	},
}
