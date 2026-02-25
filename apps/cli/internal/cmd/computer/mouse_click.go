package computer

import (
	"context"
	"strconv"

	"github.com/cofy-x/deck/apps/cli/internal/client"
	"github.com/cofy-x/deck/apps/cli/internal/output"
	daemon "github.com/cofy-x/deck/packages/client-daemon-go/daemon"
	"github.com/spf13/cobra"
)

var clickButton string

// MouseClickCmd performs a mouse click.
var MouseClickCmd = &cobra.Command{
	Use:   "click <x> <y>",
	Short: "Perform a mouse click",
	Long: `Perform a mouse click at the specified coordinates.

Examples:
  deck computer mouse click 100 200
  deck computer mouse click 500 500 --button=right`,
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
		req := daemon.MouseClickRequest{
			X:      &x32,
			Y:      &y32,
			Button: &clickButton,
		}

		ctx := context.Background()
		result, _, err := client.Client.ComputerUseAPI.Click(ctx).
			Request(req).
			Execute()
		if err != nil {
			return err
		}

		output.PrintSuccess("Mouse click performed")
		return output.Print(result)
	},
}

func init() {
	MouseClickCmd.Flags().StringVar(&clickButton, "button", "left", "Mouse button (left, right, middle)")
}
