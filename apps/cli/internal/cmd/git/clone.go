package git

import (
	"context"

	"github.com/cofy-x/deck/apps/cli/internal/client"
	"github.com/cofy-x/deck/apps/cli/internal/output"
	daemon "github.com/cofy-x/deck/packages/client-daemon-go/daemon"
	"github.com/spf13/cobra"
)

// CloneCmd clones a git repository.
var CloneCmd = &cobra.Command{
	Use:   "clone <url> <path>",
	Short: "Clone a git repository",
	Long: `Clone a git repository from a URL.

Examples:
  deck git clone https://github.com/user/repo.git /tmp/repo
  deck git clone git@github.com:user/repo.git ./repo`,
	Args:         cobra.ExactArgs(2),
	SilenceUsage: true,
	RunE: func(cmd *cobra.Command, args []string) error {
		url := args[0]
		path := args[1]

		req := daemon.GitCloneRequest{
			Url:  url,
			Path: path,
		}

		ctx := context.Background()
		result, err := client.Client.GitAPI.CloneRepository(ctx).
			Request(req).
			Execute()
		if err != nil {
			return err
		}

		output.PrintSuccess("Repository cloned successfully")
		return output.Print(result)
	},
}
