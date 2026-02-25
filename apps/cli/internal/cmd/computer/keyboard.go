package computer

import (
	"github.com/spf13/cobra"
)

// KeyboardCmd is the keyboard command group.
var KeyboardCmd = &cobra.Command{
	Use:   "keyboard",
	Short: "Keyboard control operations",
}

func init() {
	KeyboardCmd.AddCommand(KeyboardTypeCmd)
	KeyboardCmd.AddCommand(KeyboardPressCmd)
	KeyboardCmd.AddCommand(KeyboardHotkeyCmd)
}
