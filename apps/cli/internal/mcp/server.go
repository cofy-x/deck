package mcp

import (
	"github.com/cofy-x/deck/apps/cli/internal"
	"github.com/cofy-x/deck/packages/client-daemon-go/daemon"
	"github.com/mark3labs/mcp-go/server"

	"github.com/cofy-x/deck/apps/cli/internal/mcp/tools"
)

type DeckMCPServer struct {
	server.MCPServer
}

// NewServer creates an MCP server with all daemon tools registered.
func NewServer(client *daemon.APIClient) *DeckMCPServer {

	s := &DeckMCPServer{}

	s.MCPServer = *server.NewMCPServer(
		"Deck",
		internal.Version,
		server.WithToolCapabilities(false),
		server.WithRecovery(),
	)

	tools.RegisterProcessTools(&s.MCPServer, client)
	tools.RegisterFileSystemTools(&s.MCPServer, client)
	tools.RegisterGitTools(&s.MCPServer, client)
	tools.RegisterComputerUseTools(&s.MCPServer, client)
	tools.RegisterSystemTools(&s.MCPServer, client)

	return s
}

func (s *DeckMCPServer) Start() error {
	return server.ServeStdio(&s.MCPServer)
}
