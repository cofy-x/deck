package main

import (
	"fmt"
	"os"
	"strings"

	"github.com/cofy-x/deck/packages/core-go/pkg/log"
	"github.com/joho/godotenv"
	"github.com/spf13/cobra"

	"github.com/cofy-x/deck/apps/cli/internal/client"
	"github.com/cofy-x/deck/apps/cli/internal/cmd"
	"github.com/cofy-x/deck/apps/cli/internal/cmd/completion"
	"github.com/cofy-x/deck/apps/cli/internal/cmd/computer"
	"github.com/cofy-x/deck/apps/cli/internal/cmd/config"
	"github.com/cofy-x/deck/apps/cli/internal/cmd/exec"
	"github.com/cofy-x/deck/apps/cli/internal/cmd/fs"
	"github.com/cofy-x/deck/apps/cli/internal/cmd/git"
	"github.com/cofy-x/deck/apps/cli/internal/cmd/info"
	"github.com/cofy-x/deck/apps/cli/internal/cmd/mcp"
	"github.com/cofy-x/deck/apps/cli/internal/cmd/session"
	appConfig "github.com/cofy-x/deck/apps/cli/internal/config"
	"github.com/cofy-x/deck/apps/cli/internal/output"
)

var (
	daemonURL    string
	outputFormat string
	noColor      bool
	verbose      bool
)

func main() {
	_ = godotenv.Load()
	if err := rootCmd.Execute(); err != nil {
		fmt.Fprintf(os.Stderr, "Error: %v\n", err)
		os.Exit(1)
	}
}

// rootCmd is the top-level command for the Deck CLI.
var rootCmd = &cobra.Command{
	Use:               "deck",
	Short:             "Deck CLI - Control your development sandbox",
	Long:              "Deck CLI provides direct command-line access to daemon functionality and an MCP server for AI agents",
	DisableAutoGenTag: true,
	SilenceUsage:      true,
	SilenceErrors:     true,
	PersistentPreRunE: func(cmd *cobra.Command, args []string) error {
		if outputFormat != "" && !appConfig.IsValidOutputFormat(outputFormat) {
			return fmt.Errorf("invalid --format %q (must be json or text)", outputFormat)
		}

		// Skip client init for certain commands that don't need it
		cmdPath := cmd.CommandPath()
		if cmdPath == "deck version" ||
			cmdPath == "deck completion" ||
			cmdPath == "deck completion bash" ||
			cmdPath == "deck completion zsh" ||
			cmdPath == "deck completion fish" ||
			cmdPath == "deck completion powershell" ||
			cmdPath == "deck config get" ||
			cmdPath == "deck config set" ||
			cmd.Parent() != nil && cmd.Parent().Name() == "mcp" {
			return nil
		}

		// Initialize daemon client for commands that need it
		url := daemonURL
		if url == "" {
			url = appConfig.GlobalConfig.DaemonURL
		}
		return client.InitClient(url)
	},
	RunE: func(cmd *cobra.Command, args []string) error {
		return cmd.Help()
	},
}

func init() {
	// Initialize configuration
	cobra.OnInitialize(initLogger, initConfig)

	// Global persistent flags
	rootCmd.PersistentFlags().StringVar(&daemonURL, "daemon-url", "", "Daemon URL (overrides config and env)")
	rootCmd.PersistentFlags().StringVarP(&outputFormat, "format", "f", "", "Output format (json, text)")
	rootCmd.PersistentFlags().BoolVar(&noColor, "no-color", false, "Disable colored output")
	rootCmd.PersistentFlags().BoolVar(&verbose, "verbose", false, "Enable verbose debug logging")

	// Add command groups
	rootCmd.AddCommand(cmd.VersionCmd)
	rootCmd.AddCommand(mcp.MCPCmd)
	rootCmd.AddCommand(completion.CompletionCmd)
	rootCmd.AddCommand(config.ConfigCmd)
	rootCmd.AddCommand(info.InfoCmd)
	rootCmd.AddCommand(fs.FsCmd)
	rootCmd.AddCommand(git.GitCmd)
	rootCmd.AddCommand(exec.ExecCmd)
	rootCmd.AddCommand(session.SessionCmd)
	rootCmd.AddCommand(computer.ComputerCmd)

	// Other settings
	rootCmd.CompletionOptions.HiddenDefaultCmd = true
	rootCmd.PersistentFlags().BoolP("help", "", false, "help for deck")
	rootCmd.Flags().BoolP("version", "v", false, "Display the version of Deck")
	rootCmd.PreRun = func(command *cobra.Command, args []string) {
		versionFlag, _ := command.Flags().GetBool("version")
		if versionFlag {
			err := cmd.VersionCmd.RunE(command, []string{})
			if err != nil {
				log.Fatal(err.Error())
			}
			os.Exit(0)
		}
	}
}

func initConfig() {
	// Load config file
	if err := appConfig.Load(); err != nil {
		// Non-fatal, use defaults
		log.Error("Failed to load config")
	}

	// Command-line flags override config
	if daemonURL != "" {
		appConfig.GlobalConfig.DaemonURL = daemonURL
	}
	if outputFormat != "" {
		appConfig.GlobalConfig.OutputFormat = appConfig.NormalizeOutputFormat(outputFormat)
	}
	if noColor {
		appConfig.GlobalConfig.NoColor = true
	}

	// Initialize color settings
	output.InitColors()
}

func initLogger() {
	level := strings.TrimSpace(os.Getenv("DECK_LOG_LEVEL"))
	if level == "" {
		level = "info"
	}
	if verbose {
		level = "debug"
	}
	log.Init(level, true)
}
