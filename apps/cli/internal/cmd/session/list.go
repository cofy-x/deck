package session

import (
	"context"

	"github.com/cofy-x/deck/apps/cli/internal/client"
	"github.com/cofy-x/deck/apps/cli/internal/output"
	"github.com/spf13/cobra"
)

// ListCmd lists all sessions.
var ListCmd = &cobra.Command{
	Use:          "list",
	Short:        "List all sessions",
	Aliases:      []string{"ls"},
	SilenceUsage: true,
	RunE: func(cmd *cobra.Command, args []string) error {
		ctx := context.Background()
		result, _, err := client.Client.ProcessAPI.ListSessions(ctx).Execute()
		if err != nil {
			return err
		}

		return output.Print(result)
	},
}
