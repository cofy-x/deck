package session

import (
	"context"
	"fmt"

	"github.com/cofy-x/deck/apps/cli/internal/client"
	"github.com/cofy-x/deck/apps/cli/internal/httputil"
	"github.com/cofy-x/deck/apps/cli/internal/interactive"
	"github.com/cofy-x/deck/apps/cli/internal/output"
	daemon "github.com/cofy-x/deck/packages/client-daemon-go/daemon"
	"github.com/spf13/cobra"
)

// DeleteCmd deletes a session.
var DeleteCmd = &cobra.Command{
	Use:          "delete [id]",
	Short:        "Delete a session",
	Aliases:      []string{"rm"},
	SilenceUsage: true,
	RunE: func(cmd *cobra.Command, args []string) error {
		var sessionID string

		// If no session ID provided, interactive selection
		if len(args) == 0 {
			// Get list of sessions
			ctx := context.Background()

			var sessions []daemon.Session
			_, httpRespList, errList := client.Client.ProcessAPI.ListSessions(ctx).Execute()

			_, processErrList := httputil.ProcessAPIResponse(httpRespList, errList, &sessions)
			if processErrList != nil {
				return processErrList
			}

			if len(sessions) == 0 {
				return fmt.Errorf("no sessions available")
			}

			// Extract session IDs
			var sessionIDs []string
			for _, s := range sessions {
				sessionIDs = append(sessionIDs, s.GetSessionId())
			}

			// Select a session
			selected, err := interactive.SelectString("Select a session to delete:", sessionIDs)
			if err != nil {
				return err
			}

			sessionID = selected
		} else {
			sessionID = args[0]
		}

		ctx := context.Background()

		httpRespDelete, errDelete := client.Client.ProcessAPI.DeleteSession(ctx, sessionID).Execute()

		resultToPrint, processErrDelete := httputil.ProcessAPIResponse(httpRespDelete, errDelete, nil)
		if processErrDelete != nil {
			return processErrDelete
		}

		output.PrintSuccess("Session deleted successfully")

		if resultToPrint != nil {
			return output.Print(resultToPrint)
		}

		return nil
	},
}
