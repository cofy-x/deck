package fs

import (
	"context"
	"os"

	"github.com/cofy-x/deck/apps/cli/internal/client"
	"github.com/cofy-x/deck/apps/cli/internal/output"
	"github.com/spf13/cobra"
)

// WriteCmd writes content to a file.
var WriteCmd = &cobra.Command{
	Use:   "write <path> <content>",
	Short: "Write content to a file",
	Long: `Write content to a file, creating it if it doesn't exist.

Examples:
  deck fs write /tmp/file.txt "Hello World"
  deck fs write ./test.json '{"key": "value"}'`,
	Args:         cobra.ExactArgs(2),
	SilenceUsage: true,
	RunE: func(cmd *cobra.Command, args []string) error {
		path := args[0]
		content := args[1]

		// Create a temporary file with the content
		tmpFile, err := os.CreateTemp("", "deck-write-*")
		if err != nil {
			return err
		}
		defer os.Remove(tmpFile.Name())
		defer tmpFile.Close()

		if _, err := tmpFile.WriteString(content); err != nil {
			return err
		}

		// Reopen for reading
		tmpFile.Close()
		file, err := os.Open(tmpFile.Name())
		if err != nil {
			return err
		}
		defer file.Close()

		ctx := context.Background()
		result, _, err := client.Client.FileSystemAPI.UploadFile(ctx).
			Path(path).
			File(file).
			Execute()
		if err != nil {
			return err
		}

		output.PrintSuccess("File written successfully")
		return output.Print(result)
	},
}
