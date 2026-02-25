package session

import (
	"context"
	"fmt"
	"strings"

	"github.com/cofy-x/deck/apps/cli/internal/client"
	"github.com/cofy-x/deck/apps/cli/internal/interactive"
	daemon "github.com/cofy-x/deck/packages/client-daemon-go/daemon"
	"github.com/spf13/cobra"
)

// ExecCmd executes a command in a session.
var ExecCmd = &cobra.Command{
	Use:   "exec [id] <command>",
	Short: "Execute a command in a session",
	Long: `Execute a command in an interactive session.

Examples:
  deck session exec my-session "echo hello"
  deck session exec "ls -la"  # Interactive selection`,
	Args:         cobra.MinimumNArgs(1),
	SilenceUsage: true,
	RunE: func(cmd *cobra.Command, args []string) error {
		var sessionID string
		var command string

		// If only one arg, it's the command and we need to select a session
		if len(args) == 1 {
			// Get list of sessions
			ctx := context.Background()
			sessions, _, err := client.Client.ProcessAPI.ListSessions(ctx).Execute()
			if err != nil {
				return err
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
			selected, err := interactive.SelectString("Select a session:", sessionIDs)
			if err != nil {
				return err
			}

			sessionID = selected
			command = args[0]
		} else {
			sessionID = args[0]
			command = strings.Join(args[1:], " ")
		}

		req := daemon.SessionExecuteRequest{
			Command: command,
		}

		ctx := context.Background()
		result, _, err := client.Client.ProcessAPI.SessionExecuteCommand(ctx, sessionID).
			Request(req).
			Execute()
		if err != nil {
			return err
		}

		// Print the output directly (not as JSON)
		fmt.Println(result.GetOutput())
		return nil
	},
}
