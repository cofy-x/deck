package computer

import (
	"context"

	"github.com/cofy-x/deck/apps/cli/internal/client"
	"github.com/cofy-x/deck/apps/cli/internal/output"
	daemon "github.com/cofy-x/deck/packages/client-daemon-go/daemon"
	"github.com/spf13/cobra"
)

// KeyboardHotkeyCmd presses a hotkey combination.
var KeyboardHotkeyCmd = &cobra.Command{
	Use:   "hotkey <keys...>",
	Short: "Press a hotkey combination",
	Long: `Press a combination of keys simultaneously.

Examples:
  deck computer keyboard hotkey Control c
  deck computer keyboard hotkey Command Shift t`,
	Args:         cobra.MinimumNArgs(1),
	SilenceUsage: true,
	RunE: func(cmd *cobra.Command, args []string) error {
		// Join keys with "+"
		keysStr := ""
		for i, key := range args {
			if i > 0 {
				keysStr += "+"
			}
			keysStr += key
		}

		hotkeyReq := daemon.KeyboardHotkeyRequest{
			Keys: &keysStr,
		}

		ctx := context.Background()
		result, _, err := client.Client.ComputerUseAPI.PressHotkey(ctx).
			Request(hotkeyReq).
			Execute()
		if err != nil {
			return err
		}

		output.PrintSuccess("Hotkey pressed")
		return output.Print(result)
	},
}
