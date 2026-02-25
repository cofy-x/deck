package info

import (
	"context"

	"github.com/cofy-x/deck/apps/cli/internal/client"
	"github.com/cofy-x/deck/apps/cli/internal/output"
	"github.com/spf13/cobra"
)

// WorkdirCmd gets the daemon working directory.
var WorkdirCmd = &cobra.Command{
	Use:          "workdir",
	Short:        "Get daemon working directory",
	SilenceUsage: true,
	RunE: func(cmd *cobra.Command, args []string) error {
		ctx := context.Background()
		info, _, err := client.Client.InfoAPI.GetWorkDir(ctx).Execute()
		if err != nil {
			return err
		}

		result := map[string]interface{}{
			"workdir": info.GetDir(),
		}
		return output.Print(result)
	},
}
