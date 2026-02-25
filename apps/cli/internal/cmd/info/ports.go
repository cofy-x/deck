package info

import (
	"context"

	"github.com/cofy-x/deck/apps/cli/internal/client"
	"github.com/cofy-x/deck/apps/cli/internal/output"
	"github.com/spf13/cobra"
)

// PortsCmd gets the daemon available ports.
var PortsCmd = &cobra.Command{
	Use:          "ports",
	Short:        "Get daemon available ports",
	SilenceUsage: true,
	RunE: func(cmd *cobra.Command, args []string) error {
		ctx := context.Background()
		ports, _, err := client.Client.PortAPI.GetPorts(ctx).Execute()
		if err != nil {
			return err
		}

		return output.Print(ports)
	},
}
