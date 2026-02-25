package tools

import (
	"context"
	"io"

	"github.com/cofy-x/deck/packages/client-daemon-go/daemon"
	"github.com/mark3labs/mcp-go/mcp"
	"github.com/mark3labs/mcp-go/server"
)

// RegisterFileSystemTools registers file system MCP tools.
func RegisterFileSystemTools(s *server.MCPServer, client *daemon.APIClient) {
	registerListFiles(s, client)
	registerFileInfo(s, client)
	registerCreateFolder(s, client)
	registerDownloadFile(s, client)
	registerUploadFile(s, client)
	registerDeleteFile(s, client)
	registerMoveFile(s, client)
	registerSearchFiles(s, client)
	registerFindInFiles(s, client)
	registerReplaceInFiles(s, client)
}

// list_files lists files and directories at the given path.
func registerListFiles(s *server.MCPServer, client *daemon.APIClient) {
	s.AddTool(
		mcp.NewTool("list_files",
			mcp.WithDescription("List files and directories at the given path. Returns file metadata including name, size, permissions, and modification time."),
			mcp.WithString("path",
				mcp.Description("Directory path to list (defaults to working directory)"),
			),
		),
		func(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
			apiReq := client.FileSystemAPI.ListFiles(ctx)
			if path := req.GetString("path", ""); path != "" {
				apiReq = apiReq.Path(path)
			}

			files, _, err := apiReq.Execute()
			if err != nil {
				return toolError(err)
			}
			return toolSuccess(files)
		},
	)
}

// file_info gets detailed metadata about a file or directory.
func registerFileInfo(s *server.MCPServer, client *daemon.APIClient) {
	s.AddTool(
		mcp.NewTool("file_info",
			mcp.WithDescription("Get detailed information about a file or directory, including size, permissions, owner, and modification time."),
			mcp.WithString("path",
				mcp.Required(),
				mcp.Description("File or directory path"),
			),
		),
		func(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
			path, err := req.RequireString("path")
			if err != nil {
				return toolError(err)
			}

			info, _, err := client.FileSystemAPI.GetFileInfo(ctx).Path(path).Execute()
			if err != nil {
				return toolError(err)
			}
			return toolSuccess(info)
		},
	)
}

// create_folder creates a directory with optional permissions.
func registerCreateFolder(s *server.MCPServer, client *daemon.APIClient) {
	s.AddTool(
		mcp.NewTool("create_folder",
			mcp.WithDescription("Create a directory at the specified path."),
			mcp.WithString("path",
				mcp.Required(),
				mcp.Description("Directory path to create"),
			),
			mcp.WithString("mode",
				mcp.Description("Octal permission mode (default: 0755)"),
			),
		),
		func(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
			path, err := req.RequireString("path")
			if err != nil {
				return toolError(err)
			}

			mode := req.GetString("mode", "0755")
			_, err = client.FileSystemAPI.CreateFolder(ctx).Path(path).Mode(mode).Execute()
			if err != nil {
				return toolError(err)
			}
			return toolOK()
		},
	)
}

// download_file reads and returns the contents of a file.
func registerDownloadFile(s *server.MCPServer, client *daemon.APIClient) {
	s.AddTool(
		mcp.NewTool("download_file",
			mcp.WithDescription("Read and return the contents of a file."),
			mcp.WithString("path",
				mcp.Required(),
				mcp.Description("File path to read"),
			),
		),
		func(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
			path, err := req.RequireString("path")
			if err != nil {
				return toolError(err)
			}

			file, _, err := client.FileSystemAPI.DownloadFile(ctx).Path(path).Execute()
			if err != nil {
				return toolError(err)
			}
			defer file.Close()

			content, err := io.ReadAll(file)
			if err != nil {
				return toolErrorMsg("failed to read file content: " + err.Error())
			}
			return toolSuccessText(string(content))
		},
	)
}

// upload_file writes content to a file at the specified path.
func registerUploadFile(s *server.MCPServer, client *daemon.APIClient) {
	s.AddTool(
		mcp.NewTool("upload_file",
			mcp.WithDescription("Write content to a file. Creates the file if it does not exist, overwrites if it does."),
			mcp.WithString("path",
				mcp.Required(),
				mcp.Description("Destination file path"),
			),
			mcp.WithString("content",
				mcp.Required(),
				mcp.Description("File content to write"),
			),
		),
		func(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
			path, err := req.RequireString("path")
			if err != nil {
				return toolError(err)
			}
			content, err := req.RequireString("content")
			if err != nil {
				return toolError(err)
			}

			// Create a temporary file with the content for the multipart upload.
			tmpFile, err := createTempFile(content)
			if err != nil {
				return toolErrorMsg("failed to prepare upload: " + err.Error())
			}
			defer removeTempFile(tmpFile)

			_, _, err = client.FileSystemAPI.UploadFile(ctx).Path(path).File(tmpFile).Execute()
			if err != nil {
				return toolError(err)
			}
			return toolOK()
		},
	)
}

// delete_file removes a file or directory.
func registerDeleteFile(s *server.MCPServer, client *daemon.APIClient) {
	s.AddTool(
		mcp.NewTool("delete_file",
			mcp.WithDescription("Delete a file or directory."),
			mcp.WithString("path",
				mcp.Required(),
				mcp.Description("File or directory path to delete"),
			),
			mcp.WithBoolean("recursive",
				mcp.Description("Enable recursive deletion for directories (default: false)"),
			),
		),
		func(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
			path, err := req.RequireString("path")
			if err != nil {
				return toolError(err)
			}

			apiReq := client.FileSystemAPI.DeleteFile(ctx).Path(path)

			recursive, err := req.RequireBool("recursive")
			if err == nil {
				apiReq = apiReq.Recursive(recursive)
			}

			_, err = apiReq.Execute()
			if err != nil {
				return toolError(err)
			}
			return toolOK()
		},
	)
}

// move_file moves or renames a file or directory.
func registerMoveFile(s *server.MCPServer, client *daemon.APIClient) {
	s.AddTool(
		mcp.NewTool("move_file",
			mcp.WithDescription("Move or rename a file or directory."),
			mcp.WithString("source",
				mcp.Required(),
				mcp.Description("Source file or directory path"),
			),
			mcp.WithString("destination",
				mcp.Required(),
				mcp.Description("Destination file or directory path"),
			),
		),
		func(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
			source, err := req.RequireString("source")
			if err != nil {
				return toolError(err)
			}
			destination, err := req.RequireString("destination")
			if err != nil {
				return toolError(err)
			}

			_, err = client.FileSystemAPI.MoveFile(ctx).Source(source).Destination(destination).Execute()
			if err != nil {
				return toolError(err)
			}
			return toolOK()
		},
	)
}

// search_files searches for files matching a glob pattern.
func registerSearchFiles(s *server.MCPServer, client *daemon.APIClient) {
	s.AddTool(
		mcp.NewTool("search_files",
			mcp.WithDescription("Search for files matching a pattern (e.g., *.txt, *.go) within a directory."),
			mcp.WithString("path",
				mcp.Required(),
				mcp.Description("Directory path to search in"),
			),
			mcp.WithString("pattern",
				mcp.Required(),
				mcp.Description("File pattern to match (e.g., *.txt, *.go)"),
			),
		),
		func(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
			path, err := req.RequireString("path")
			if err != nil {
				return toolError(err)
			}
			pattern, err := req.RequireString("pattern")
			if err != nil {
				return toolError(err)
			}

			result, _, err := client.FileSystemAPI.SearchFiles(ctx).Path(path).Pattern(pattern).Execute()
			if err != nil {
				return toolError(err)
			}
			return toolSuccess(result)
		},
	)
}

// find_in_files searches for text content within files (grep-like).
func registerFindInFiles(s *server.MCPServer, client *daemon.APIClient) {
	s.AddTool(
		mcp.NewTool("find_in_files",
			mcp.WithDescription("Search for a text pattern inside files within a directory (grep-like search)."),
			mcp.WithString("path",
				mcp.Required(),
				mcp.Description("Directory path to search in"),
			),
			mcp.WithString("pattern",
				mcp.Required(),
				mcp.Description("Text pattern to search for"),
			),
		),
		func(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
			path, err := req.RequireString("path")
			if err != nil {
				return toolError(err)
			}
			pattern, err := req.RequireString("pattern")
			if err != nil {
				return toolError(err)
			}

			matches, _, err := client.FileSystemAPI.FindInFiles(ctx).Path(path).Pattern(pattern).Execute()
			if err != nil {
				return toolError(err)
			}
			return toolSuccess(matches)
		},
	)
}

// replace_in_files performs find-and-replace across multiple files.
func registerReplaceInFiles(s *server.MCPServer, client *daemon.APIClient) {
	s.AddTool(
		mcp.NewTool("replace_in_files",
			mcp.WithDescription("Find and replace a text pattern across multiple files."),
			mcp.WithString("pattern",
				mcp.Required(),
				mcp.Description("Text pattern to find"),
			),
			mcp.WithString("new_value",
				mcp.Required(),
				mcp.Description("Replacement text"),
			),
			mcp.WithObject("files",
				mcp.Required(),
				mcp.Description("List of file paths to perform replacement in (JSON array of strings)"),
			),
		),
		func(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
			pattern, err := req.RequireString("pattern")
			if err != nil {
				return toolError(err)
			}
			newValue, err := req.RequireString("new_value")
			if err != nil {
				return toolError(err)
			}

			files, err := getStringArrayArg(req, "files", true)
			if err != nil {
				return toolErrorMsg(err.Error())
			}

			replaceReq := daemon.ReplaceRequest{
				Pattern:  pattern,
				NewValue: newValue,
				Files:    files,
			}

			results, _, err := client.FileSystemAPI.ReplaceInFiles(ctx).Request(replaceReq).Execute()
			if err != nil {
				return toolError(err)
			}
			return toolSuccess(results)
		},
	)
}
