package computer

import (
	"github.com/spf13/cobra"
)

// ComputerCmd is the computer control command group.
var ComputerCmd = &cobra.Command{
	Use:   "computer",
	Short: "Computer control operations",
	Long:  "Control computer operations like screenshots, mouse, keyboard, and browser",
}

func init() {
	ComputerCmd.AddCommand(ScreenshotCmd)
	ComputerCmd.AddCommand(DisplayInfoCmd)
	ComputerCmd.AddCommand(WindowsCmd)
	ComputerCmd.AddCommand(MouseCmd)
	ComputerCmd.AddCommand(KeyboardCmd)
	ComputerCmd.AddCommand(BrowserCmd)
}
