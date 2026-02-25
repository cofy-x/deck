package completion

import (
	"os"

	"github.com/spf13/cobra"
)

// CompletionCmd generates shell completion scripts.
var CompletionCmd = &cobra.Command{
	Use:   "completion [bash|zsh|fish|powershell]",
	Short: "Generate shell completion script",
	Long: `Generate shell completion script for deck CLI.

Example:
  # Bash
  source <(deck completion bash)
  # or add to ~/.bashrc:
  echo 'source <(deck completion bash)' >> ~/.bashrc

  # Zsh
  source <(deck completion zsh)
  # or add to ~/.zshrc:
  echo 'source <(deck completion zsh)' >> ~/.zshrc

  # Fish
  deck completion fish | source
  # or add to ~/.config/fish/config.fish:
  echo 'deck completion fish | source' >> ~/.config/fish/config.fish

  # PowerShell
  deck completion powershell | Out-String | Invoke-Expression`,
	Args:                  cobra.ExactArgs(1),
	ValidArgs:             []string{"bash", "zsh", "fish", "powershell"},
	DisableFlagsInUseLine: true,
	SilenceUsage:          true,
	RunE: func(cmd *cobra.Command, args []string) error {
		switch args[0] {
		case "bash":
			return cmd.Root().GenBashCompletion(os.Stdout)
		case "zsh":
			return cmd.Root().GenZshCompletion(os.Stdout)
		case "fish":
			return cmd.Root().GenFishCompletion(os.Stdout, true)
		case "powershell":
			return cmd.Root().GenPowerShellCompletion(os.Stdout)
		}
		return nil
	},
}
