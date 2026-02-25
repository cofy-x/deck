package fs

import (
	"context"
	"fmt"
	"io"
	"net/http"

	"github.com/cofy-x/deck/apps/cli/internal/client"
	"github.com/spf13/cobra"
)

// CatCmd reads file contents.
var CatCmd = &cobra.Command{
	Use:   "cat <path>",
	Short: "Read file contents",
	Long: `Read and display the contents of a file.

Examples:
  deck fs cat /tmp/file.txt
  deck fs cat ./README.md`,
	Args:         cobra.ExactArgs(1),
	SilenceUsage: true,
	RunE: func(cmd *cobra.Command, args []string) error {
		path := args[0]

		ctx := context.Background()
		info, httpResp, err := client.Client.FileSystemAPI.GetFileInfo(ctx).
			Path(path).
			Execute()
		if err != nil {
			if httpResp != nil && httpResp.StatusCode == http.StatusNotFound {
				return fmt.Errorf("cannot cat %q: path not found", path)
			}
			return err
		}
		if info.IsDir {
			return fmt.Errorf("cannot cat %q: path is a directory; use `deck fs ls %s`", path, path)
		}

		file, httpResp, err := client.Client.FileSystemAPI.DownloadFile(ctx).
			Path(path).
			Execute()
		if err != nil {
			if httpResp != nil && httpResp.StatusCode == http.StatusNotFound {
				return fmt.Errorf("cannot cat %q: path not found", path)
			}
			return err
		}
		defer file.Close()

		content, err := io.ReadAll(file)
		if err != nil {
			return err
		}

		fmt.Println(string(content))
		return nil
	},
}
