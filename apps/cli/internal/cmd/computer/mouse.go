package computer

import (
	"github.com/spf13/cobra"
)

// MouseCmd is the mouse command group.
var MouseCmd = &cobra.Command{
	Use:   "mouse",
	Short: "Mouse control operations",
}

func init() {
	MouseCmd.AddCommand(MouseClickCmd)
	MouseCmd.AddCommand(MouseMoveCmd)
	MouseCmd.AddCommand(MouseDragCmd)
	MouseCmd.AddCommand(MouseScrollCmd)
}
