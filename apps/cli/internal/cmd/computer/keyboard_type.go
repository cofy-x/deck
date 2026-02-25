package computer

import (
	"context"

	"github.com/cofy-x/deck/apps/cli/internal/client"
	"github.com/cofy-x/deck/apps/cli/internal/output"
	daemon "github.com/cofy-x/deck/packages/client-daemon-go/daemon"
	"github.com/spf13/cobra"
)

// KeyboardTypeCmd types text.
var KeyboardTypeCmd = &cobra.Command{
	Use:   "type <text>",
	Short: "Type text",
	Long: `Type text as keyboard input.

Examples:
  deck computer keyboard type "Hello World"`,
	Args:         cobra.ExactArgs(1),
	SilenceUsage: true,
	RunE: func(cmd *cobra.Command, args []string) error {
		text := args[0]

		req := daemon.KeyboardTypeRequest{
			Text: &text,
		}

		ctx := context.Background()
		result, _, err := client.Client.ComputerUseAPI.TypeText(ctx).
			Request(req).
			Execute()
		if err != nil {
			return err
		}

		output.PrintSuccess("Text typed")
		return output.Print(result)
	},
}
