package computer

import (
	"context"

	"github.com/cofy-x/deck/apps/cli/internal/client"
	"github.com/cofy-x/deck/apps/cli/internal/output"
	daemon "github.com/cofy-x/deck/packages/client-daemon-go/daemon"
	"github.com/spf13/cobra"
)

var browserIncognito bool

// BrowserCmd opens a URL in the browser.
var BrowserCmd = &cobra.Command{
	Use:   "browser <url>",
	Short: "Open a URL in the browser",
	Long: `Open a URL in the default web browser.

Examples:
  deck computer browser https://example.com
  deck computer browser https://github.com --incognito`,
	Args:         cobra.ExactArgs(1),
	SilenceUsage: true,
	RunE: func(cmd *cobra.Command, args []string) error {
		url := args[0]

		req := daemon.BrowserOpenRequest{
			Url:       &url,
			Incognito: &browserIncognito,
		}

		ctx := context.Background()
		result, _, err := client.Client.ComputerUseAPI.OpenBrowser(ctx).
			Request(req).
			Execute()
		if err != nil {
			return err
		}

		output.PrintSuccess("Browser opened")
		return output.Print(result)
	},
}

func init() {
	BrowserCmd.Flags().BoolVar(&browserIncognito, "incognito", false, "Open in incognito/private mode")
}
