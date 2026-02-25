package computer

import (
	"context"

	"github.com/cofy-x/deck/apps/cli/internal/client"
	"github.com/cofy-x/deck/apps/cli/internal/output"
	"github.com/spf13/cobra"
)

// DisplayInfoCmd gets display information.
var DisplayInfoCmd = &cobra.Command{
	Use:          "display-info",
	Short:        "Get display information",
	SilenceUsage: true,
	RunE: func(cmd *cobra.Command, args []string) error {
		ctx := context.Background()
		info, _, err := client.Client.ComputerUseAPI.GetDisplayInfo(ctx).Execute()
		if err != nil {
			return err
		}

		return output.Print(info)
	},
}
