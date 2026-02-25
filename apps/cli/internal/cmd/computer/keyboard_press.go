package computer

import (
	"context"

	"github.com/cofy-x/deck/apps/cli/internal/client"
	"github.com/cofy-x/deck/apps/cli/internal/output"
	daemon "github.com/cofy-x/deck/packages/client-daemon-go/daemon"
	"github.com/spf13/cobra"
)

// KeyboardPressCmd presses a key.
var KeyboardPressCmd = &cobra.Command{
	Use:   "press <key>",
	Short: "Press a key",
	Long: `Press a single key or special key.

Examples:
  deck computer keyboard press Enter
  deck computer keyboard press Escape`,
	Args:         cobra.ExactArgs(1),
	SilenceUsage: true,
	RunE: func(cmd *cobra.Command, args []string) error {
		key := args[0]

		req := daemon.KeyboardPressRequest{
			Key: &key,
		}

		ctx := context.Background()
		result, _, err := client.Client.ComputerUseAPI.PressKey(ctx).
			Request(req).
			Execute()
		if err != nil {
			return err
		}

		output.PrintSuccess("Key pressed")
		return output.Print(result)
	},
}
