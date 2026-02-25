package computer

import (
	"context"
	"strconv"

	"github.com/cofy-x/deck/apps/cli/internal/client"
	"github.com/cofy-x/deck/apps/cli/internal/output"
	daemon "github.com/cofy-x/deck/packages/client-daemon-go/daemon"
	"github.com/spf13/cobra"
)

// MouseDragCmd performs a mouse drag operation.
var MouseDragCmd = &cobra.Command{
	Use:   "drag <x1> <y1> <x2> <y2>",
	Short: "Perform a mouse drag operation",
	Long: `Drag the mouse from one point to another.

Examples:
  deck computer mouse drag 100 100 200 200`,
	Args:         cobra.ExactArgs(4),
	SilenceUsage: true,
	RunE: func(cmd *cobra.Command, args []string) error {
		x1, err := strconv.ParseInt(args[0], 10, 32)
		if err != nil {
			return err
		}
		y1, err := strconv.ParseInt(args[1], 10, 32)
		if err != nil {
			return err
		}
		x2, err := strconv.ParseInt(args[2], 10, 32)
		if err != nil {
			return err
		}
		y2, err := strconv.ParseInt(args[3], 10, 32)
		if err != nil {
			return err
		}

		x1_32 := int32(x1)
		y1_32 := int32(y1)
		x2_32 := int32(x2)
		y2_32 := int32(y2)
		req := daemon.MouseDragRequest{
			StartX: &x1_32,
			StartY: &y1_32,
			EndX:   &x2_32,
			EndY:   &y2_32,
		}

		ctx := context.Background()
		result, _, err := client.Client.ComputerUseAPI.Drag(ctx).
			Request(req).
			Execute()
		if err != nil {
			return err
		}

		output.PrintSuccess("Mouse drag performed")
		return output.Print(result)
	},
}
