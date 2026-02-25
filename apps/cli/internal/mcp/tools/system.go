package tools

import (
	"context"

	"github.com/cofy-x/deck/packages/client-daemon-go/daemon"
	"github.com/mark3labs/mcp-go/mcp"
	"github.com/mark3labs/mcp-go/server"
)

// RegisterSystemTools registers system information MCP tools.
func RegisterSystemTools(s *server.MCPServer, client *daemon.APIClient) {
	registerGetVersion(s, client)
	registerGetWorkDir(s, client)
	registerGetHomeDir(s, client)
	registerGetPorts(s, client)
}

// get_version returns the daemon version information.
func registerGetVersion(s *server.MCPServer, client *daemon.APIClient) {
	s.AddTool(
		mcp.NewTool("get_version",
			mcp.WithDescription("Get the daemon version information."),
		),
		func(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
			version, _, err := client.InfoAPI.GetVersion(ctx).Execute()
			if err != nil {
				return toolError(err)
			}
			return toolSuccess(version)
		},
	)
}

// get_work_dir returns the current working directory.
func registerGetWorkDir(s *server.MCPServer, client *daemon.APIClient) {
	s.AddTool(
		mcp.NewTool("get_work_dir",
			mcp.WithDescription("Get the current working directory of the sandbox."),
		),
		func(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
			result, _, err := client.InfoAPI.GetWorkDir(ctx).Execute()
			if err != nil {
				return toolError(err)
			}
			return toolSuccess(result)
		},
	)
}

// get_home_dir returns the user home directory.
func registerGetHomeDir(s *server.MCPServer, client *daemon.APIClient) {
	s.AddTool(
		mcp.NewTool("get_home_dir",
			mcp.WithDescription("Get the home directory of the current user in the sandbox."),
		),
		func(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
			result, _, err := client.InfoAPI.GetUserHomeDir(ctx).Execute()
			if err != nil {
				return toolError(err)
			}
			return toolSuccess(result)
		},
	)
}

// get_ports returns a list of active/listening ports.
func registerGetPorts(s *server.MCPServer, client *daemon.APIClient) {
	s.AddTool(
		mcp.NewTool("get_ports",
			mcp.WithDescription("Get a list of all currently active and listening ports in the sandbox."),
		),
		func(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
			result, _, err := client.PortAPI.GetPorts(ctx).Execute()
			if err != nil {
				return toolError(err)
			}
			return toolSuccess(result)
		},
	)
}
