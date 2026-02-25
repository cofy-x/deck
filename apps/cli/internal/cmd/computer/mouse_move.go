package computer

import (
	"context"
	"strconv"

	"github.com/cofy-x/deck/apps/cli/internal/client"
	"github.com/cofy-x/deck/apps/cli/internal/output"
	daemon "github.com/cofy-x/deck/packages/client-daemon-go/daemon"
	"github.com/spf13/cobra"
)

// MouseMoveCmd moves the mouse cursor.
var MouseMoveCmd = &cobra.Command{
	Use:   "move <x> <y>",
	Short: "Move the mouse cursor",
	Long: `Move the mouse cursor to the specified coordinates.

Examples:
  deck computer mouse move 100 200`,
	Args:         cobra.ExactArgs(2),
	SilenceUsage: true,
	RunE: func(cmd *cobra.Command, args []string) error {
		x, err := strconv.ParseInt(args[0], 10, 32)
		if err != nil {
			return err
		}
		y, err := strconv.ParseInt(args[1], 10, 32)
		if err != nil {
			return err
		}

		x32 := int32(x)
		y32 := int32(y)
		req := daemon.MouseMoveRequest{
			X: &x32,
			Y: &y32,
		}

		ctx := context.Background()
		result, _, err := client.Client.ComputerUseAPI.MoveMouse(ctx).
			Request(req).
			Execute()
		if err != nil {
			return err
		}

		output.PrintSuccess("Mouse moved")
		return output.Print(result)
	},
}
