package info

import (
	"context"

	"github.com/cofy-x/deck/apps/cli/internal/client"
	"github.com/cofy-x/deck/apps/cli/internal/output"
	"github.com/spf13/cobra"
)

// HomedirCmd gets the daemon home directory.
var HomedirCmd = &cobra.Command{
	Use:          "homedir",
	Short:        "Get daemon home directory",
	SilenceUsage: true,
	RunE: func(cmd *cobra.Command, args []string) error {
		ctx := context.Background()
		info, _, err := client.Client.InfoAPI.GetUserHomeDir(ctx).Execute()
		if err != nil {
			return err
		}

		result := map[string]interface{}{
			"homedir": info.GetDir(),
		}
		return output.Print(result)
	},
}
