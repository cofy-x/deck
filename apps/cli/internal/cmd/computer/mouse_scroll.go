package computer

import (
	"context"
	"strconv"

	"github.com/cofy-x/deck/apps/cli/internal/client"
	"github.com/cofy-x/deck/apps/cli/internal/output"
	daemon "github.com/cofy-x/deck/packages/client-daemon-go/daemon"
	"github.com/spf13/cobra"
)

// MouseScrollCmd performs a mouse scroll operation.
var MouseScrollCmd = &cobra.Command{
	Use:   "scroll <x> <y> <direction>",
	Short: "Perform a mouse scroll operation",
	Long: `Scroll at the specified coordinates in the given direction.

Examples:
  deck computer mouse scroll 100 100 up
  deck computer mouse scroll 200 200 down`,
	Args:         cobra.ExactArgs(3),
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
		direction := args[2]

		x32 := int32(x)
		y32 := int32(y)
		req := daemon.MouseScrollRequest{
			X:         &x32,
			Y:         &y32,
			Direction: &direction,
		}

		ctx := context.Background()
		result, _, err := client.Client.ComputerUseAPI.Scroll(ctx).
			Request(req).
			Execute()
		if err != nil {
			return err
		}

		output.PrintSuccess("Mouse scroll performed")
		return output.Print(result)
	},
}
