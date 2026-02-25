package computer

import (
	"context"

	"github.com/cofy-x/deck/apps/cli/internal/client"
	"github.com/cofy-x/deck/apps/cli/internal/output"
	"github.com/spf13/cobra"
)

// WindowsCmd lists open windows.
var WindowsCmd = &cobra.Command{
	Use:          "windows",
	Short:        "List open windows",
	SilenceUsage: true,
	RunE: func(cmd *cobra.Command, args []string) error {
		ctx := context.Background()
		windows, _, err := client.Client.ComputerUseAPI.GetWindows(ctx).Execute()
		if err != nil {
			return err
		}

		return output.Print(windows)
	},
}
