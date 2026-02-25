package mcp

import (
	"context"
	"fmt"
	"os"
	"os/signal"

	appConfig "github.com/cofy-x/deck/apps/cli/internal/config"
	"github.com/cofy-x/deck/apps/cli/internal/mcp"
	"github.com/cofy-x/deck/packages/client-daemon-go/daemon"
	"github.com/cofy-x/deck/packages/core-go/pkg/log"
	"github.com/spf13/cobra"
)

var StartCmd = &cobra.Command{
	Use:   "serve",
	Short: "Start the MCP tool server over stdio",
	Long:  "Start a Model Context Protocol server that exposes daemon sandbox capabilities as tools for AI agents.",
	Args:  cobra.NoArgs,
	RunE: func(cmd *cobra.Command, args []string) error {
		daemonURL := appConfig.GlobalConfig.DaemonURL
		if daemonURL == "" {
			return fmt.Errorf("daemon URL is empty")
		}

		cfg := daemon.NewConfiguration()
		cfg.Servers[0].URL = daemonURL

		client := daemon.NewAPIClient(cfg)
		server := mcp.NewServer(client)

		log.SetOutput(os.Stderr)
		log.Info(fmt.Sprintf("Starting Deck MCP server (daemon: %s)", daemonURL))

		ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt)
		defer stop()

		errChan := make(chan error)

		go func() {
			errChan <- server.Start()
		}()

		select {
		case err := <-errChan:
			return err
		case <-ctx.Done():
			return nil
		}
	},
}
