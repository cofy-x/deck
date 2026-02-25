package info

import (
	"context"

	"github.com/cofy-x/deck/apps/cli/internal/client"
	"github.com/cofy-x/deck/apps/cli/internal/output"
	"github.com/spf13/cobra"
)

// VersionCmd gets the daemon version.
var VersionCmd = &cobra.Command{
	Use:          "version",
	Short:        "Get daemon version",
	SilenceUsage: true,
	RunE: func(cmd *cobra.Command, args []string) error {
		ctx := context.Background()
		version, _, err := client.Client.InfoAPI.GetVersion(ctx).Execute()
		if err != nil {
			return err
		}
		return output.Print(version)
	},
}
