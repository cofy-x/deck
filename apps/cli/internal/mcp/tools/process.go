package tools

import (
	"context"

	"github.com/cofy-x/deck/packages/client-daemon-go/daemon"
	"github.com/mark3labs/mcp-go/mcp"
	"github.com/mark3labs/mcp-go/server"
)

// RegisterProcessTools registers process/command execution MCP tools.
func RegisterProcessTools(s *server.MCPServer, client *daemon.APIClient) {
	registerExecuteCommand(s, client)
	registerCreateSession(s, client)
	registerSessionExecute(s, client)
	registerGetSessionCommandLogs(s, client)
	registerListSessions(s, client)
	registerDeleteSession(s, client)
}

// execute_command runs a command synchronously and returns the output.
func registerExecuteCommand(s *server.MCPServer, client *daemon.APIClient) {
	s.AddTool(
		mcp.NewTool("execute_command",
			mcp.WithDescription("Execute a shell command and return its output. For long-running or interactive commands, consider using sessions instead."),
			mcp.WithString("command",
				mcp.Required(),
				mcp.Description("The shell command to execute"),
			),
			mcp.WithString("cwd",
				mcp.Description("Working directory for the command (optional)"),
			),
			mcp.WithNumber("timeout",
				mcp.Description("Timeout in seconds (default: 10)"),
			),
		),
		func(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
			command, err := req.RequireString("command")
			if err != nil {
				return toolError(err)
			}

			execReq := daemon.ExecuteRequest{
				Command: command,
			}

			if cwd := req.GetString("cwd", ""); cwd != "" {
				execReq.Cwd = stringPtr(cwd)
			}
			if timeout := req.GetFloat("timeout", 0); timeout > 0 {
				t := int32(timeout)
				execReq.Timeout = &t
			}

			result, _, err := client.ProcessAPI.ExecuteCommand(ctx).Request(execReq).Execute()
			if err != nil {
				return toolError(err)
			}
			return toolSuccess(result)
		},
	)
}

// create_session creates a persistent terminal session.
func registerCreateSession(s *server.MCPServer, client *daemon.APIClient) {
	s.AddTool(
		mcp.NewTool("create_session",
			mcp.WithDescription("Create a persistent terminal session for running multiple commands sequentially."),
			mcp.WithString("session_id",
				mcp.Required(),
				mcp.Description("Unique identifier for the session"),
			),
		),
		func(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
			sessionID, err := req.RequireString("session_id")
			if err != nil {
				return toolError(err)
			}

			createReq := daemon.CreateSessionRequest{
				SessionId: sessionID,
			}

			_, err = client.ProcessAPI.CreateSession(ctx).Request(createReq).Execute()
			if err != nil {
				return toolError(err)
			}
			return toolSuccess(map[string]string{
				"status":     "created",
				"session_id": sessionID,
			})
		},
	)
}

// session_execute runs a command within an existing session.
func registerSessionExecute(s *server.MCPServer, client *daemon.APIClient) {
	s.AddTool(
		mcp.NewTool("session_execute",
			mcp.WithDescription("Execute a command within an existing terminal session. Supports asynchronous execution."),
			mcp.WithString("session_id",
				mcp.Required(),
				mcp.Description("Session ID to execute the command in"),
			),
			mcp.WithString("command",
				mcp.Required(),
				mcp.Description("The shell command to execute"),
			),
			mcp.WithBoolean("async",
				mcp.Description("Run the command asynchronously (default: false)"),
			),
		),
		func(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
			sessionID, err := req.RequireString("session_id")
			if err != nil {
				return toolError(err)
			}
			command, err := req.RequireString("command")
			if err != nil {
				return toolError(err)
			}

			execReq := daemon.SessionExecuteRequest{
				Command: command,
			}

			async, err := req.RequireBool("async")
			if err == nil {
				execReq.Async = boolPtr(async)
			}

			result, _, err := client.ProcessAPI.SessionExecuteCommand(ctx, sessionID).Request(execReq).Execute()
			if err != nil {
				return toolError(err)
			}
			return toolSuccess(result)
		},
	)
}

// get_session_command_logs retrieves logs for a specific command in a session.
func registerGetSessionCommandLogs(s *server.MCPServer, client *daemon.APIClient) {
	s.AddTool(
		mcp.NewTool("get_session_command_logs",
			mcp.WithDescription("Get the output logs for a specific command executed in a session."),
			mcp.WithString("session_id",
				mcp.Required(),
				mcp.Description("Session ID"),
			),
			mcp.WithString("command_id",
				mcp.Required(),
				mcp.Description("Command ID to retrieve logs for"),
			),
		),
		func(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
			sessionID, err := req.RequireString("session_id")
			if err != nil {
				return toolError(err)
			}
			commandID, err := req.RequireString("command_id")
			if err != nil {
				return toolError(err)
			}

			logs, _, err := client.ProcessAPI.GetSessionCommandLogs(ctx, sessionID, commandID).Execute()
			if err != nil {
				return toolError(err)
			}
			return toolSuccessText(logs)
		},
	)
}

// list_sessions lists all active terminal sessions.
func registerListSessions(s *server.MCPServer, client *daemon.APIClient) {
	s.AddTool(
		mcp.NewTool("list_sessions",
			mcp.WithDescription("List all active terminal sessions."),
		),
		func(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
			sessions, _, err := client.ProcessAPI.ListSessions(ctx).Execute()
			if err != nil {
				return toolError(err)
			}
			return toolSuccess(sessions)
		},
	)
}

// delete_session removes an existing terminal session.
func registerDeleteSession(s *server.MCPServer, client *daemon.APIClient) {
	s.AddTool(
		mcp.NewTool("delete_session",
			mcp.WithDescription("Delete an existing terminal session."),
			mcp.WithString("session_id",
				mcp.Required(),
				mcp.Description("Session ID to delete"),
			),
		),
		func(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
			sessionID, err := req.RequireString("session_id")
			if err != nil {
				return toolError(err)
			}

			_, err = client.ProcessAPI.DeleteSession(ctx, sessionID).Execute()
			if err != nil {
				return toolError(err)
			}
			return toolOK()
		},
	)
}
