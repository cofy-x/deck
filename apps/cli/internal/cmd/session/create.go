package session

import (
	"context"

	"github.com/cofy-x/deck/apps/cli/internal/client"
	"github.com/cofy-x/deck/apps/cli/internal/httputil" // Import the new utility package
	"github.com/cofy-x/deck/apps/cli/internal/output"
	daemon "github.com/cofy-x/deck/packages/client-daemon-go/daemon"
	"github.com/spf13/cobra"
)

// CreateCmd creates a new session.
var CreateCmd = &cobra.Command{
	Use:   "create <id>",
	Short: "Create a new interactive session",
	Long: `Create a new interactive session for running commands.

Examples:
  deck session create my-session`,
	Args:         cobra.ExactArgs(1),
	SilenceUsage: true,
	RunE: func(cmd *cobra.Command, args []string) error {
		sessionID := args[0]

		req := daemon.CreateSessionRequest{
			SessionId: sessionID,
		}

		ctx := context.Background()
		httpResp, err := client.Client.ProcessAPI.CreateSession(ctx).
			Request(req).
			Execute()

		resultToPrint, processErr := httputil.ProcessAPIResponse(httpResp, err, nil)
		if processErr != nil {
			return processErr
		}

		output.PrintSuccess("Session created successfully")

		// Only print if there's content to print
		if resultToPrint != nil {
			return output.Print(resultToPrint)
		}

		return nil // Success, with no content to print
	},
}
