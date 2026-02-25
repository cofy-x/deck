package git

import (
	"context"
	"fmt"
	"os"
	"strings"

	"github.com/cofy-x/deck/apps/cli/internal/client"
	"github.com/cofy-x/deck/apps/cli/internal/output"
	daemon "github.com/cofy-x/deck/packages/client-daemon-go/daemon"
	"github.com/spf13/cobra"
)

var (
	commitMessage string
	commitAuthor  string
	commitEmail   string
)

// CommitCmd commits staged changes.
var CommitCmd = &cobra.Command{
	Use:   "commit <path>",
	Short: "Commit staged changes",
	Long: `Commit staged changes in a git repository.

Examples:
  deck git commit . -m "Initial commit" --author "Alice" --email "alice@example.com"
  deck git commit /path/to/repo -m "Fix bug"`,
	Args:         cobra.ExactArgs(1),
	SilenceUsage: true,
	RunE: func(cmd *cobra.Command, args []string) error {
		path := args[0]

		author, email, err := resolveCommitIdentity(commitAuthor, commitEmail)
		if err != nil {
			return err
		}

		req := daemon.GitCommitRequest{
			Path:    path,
			Message: commitMessage,
			Author:  author,
			Email:   email,
		}

		ctx := context.Background()
		result, _, err := client.Client.GitAPI.CommitChanges(ctx).
			Request(req).
			Execute()
		if err != nil {
			return err
		}

		output.PrintSuccess("Changes committed successfully")
		return output.Print(result)
	},
}

func init() {
	CommitCmd.Flags().StringVarP(&commitMessage, "message", "m", "", "Commit message (required)")
	CommitCmd.Flags().StringVar(&commitAuthor, "author", "", "Commit author name (fallback: GIT_AUTHOR_NAME or GIT_COMMITTER_NAME)")
	CommitCmd.Flags().StringVar(&commitEmail, "email", "", "Commit author email (fallback: GIT_AUTHOR_EMAIL or GIT_COMMITTER_EMAIL)")
	_ = CommitCmd.MarkFlagRequired("message")
}

func resolveCommitIdentity(authorFlag, emailFlag string) (string, string, error) {
	author := strings.TrimSpace(authorFlag)
	email := strings.TrimSpace(emailFlag)

	if author == "" {
		author = firstNonEmptyEnv("GIT_AUTHOR_NAME", "GIT_COMMITTER_NAME")
	}
	if email == "" {
		email = firstNonEmptyEnv("GIT_AUTHOR_EMAIL", "GIT_COMMITTER_EMAIL")
	}

	if author == "" || email == "" {
		return "", "", fmt.Errorf("author/email are required: pass --author and --email, or set GIT_AUTHOR_NAME/GIT_AUTHOR_EMAIL")
	}

	return author, email, nil
}

func firstNonEmptyEnv(keys ...string) string {
	for _, key := range keys {
		if value := strings.TrimSpace(os.Getenv(key)); value != "" {
			return value
		}
	}
	return ""
}
