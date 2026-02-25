package tools

import (
	"context"

	"github.com/cofy-x/deck/packages/client-daemon-go/daemon"
	"github.com/mark3labs/mcp-go/mcp"
	"github.com/mark3labs/mcp-go/server"
)

// RegisterGitTools registers Git-related MCP tools.
func RegisterGitTools(s *server.MCPServer, client *daemon.APIClient) {
	registerGitClone(s, client)
	registerGitStatus(s, client)
	registerGitAdd(s, client)
	registerGitCommit(s, client)
	registerGitBranches(s, client)
	registerGitCheckout(s, client)
	registerGitCreateBranch(s, client)
	registerGitPull(s, client)
	registerGitPush(s, client)
}

// git_clone clones a Git repository.
func registerGitClone(s *server.MCPServer, client *daemon.APIClient) {
	s.AddTool(
		mcp.NewTool("git_clone",
			mcp.WithDescription("Clone a Git repository to a local path."),
			mcp.WithString("url",
				mcp.Required(),
				mcp.Description("Repository URL to clone"),
			),
			mcp.WithString("path",
				mcp.Required(),
				mcp.Description("Local path to clone into"),
			),
			mcp.WithString("branch",
				mcp.Description("Branch to clone (optional)"),
			),
			mcp.WithString("username",
				mcp.Description("Username for authentication (optional)"),
			),
			mcp.WithString("password",
				mcp.Description("Password for authentication (optional)"),
			),
		),
		func(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
			repoURL, err := req.RequireString("url")
			if err != nil {
				return toolError(err)
			}
			path, err := req.RequireString("path")
			if err != nil {
				return toolError(err)
			}

			cloneReq := daemon.GitCloneRequest{
				Url:  repoURL,
				Path: path,
			}

			if branch := req.GetString("branch", ""); branch != "" {
				cloneReq.Branch = stringPtr(branch)
			}
			if username := req.GetString("username", ""); username != "" {
				cloneReq.Username = stringPtr(username)
			}
			if password := req.GetString("password", ""); password != "" {
				cloneReq.Password = stringPtr(password)
			}

			_, err = client.GitAPI.CloneRepository(ctx).Request(cloneReq).Execute()
			if err != nil {
				return toolError(err)
			}
			return toolOK()
		},
	)
}

// git_status returns the Git status of a repository.
func registerGitStatus(s *server.MCPServer, client *daemon.APIClient) {
	s.AddTool(
		mcp.NewTool("git_status",
			mcp.WithDescription("Get the Git status of a repository, showing staged, modified, and untracked files."),
			mcp.WithString("path",
				mcp.Required(),
				mcp.Description("Repository path"),
			),
		),
		func(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
			path, err := req.RequireString("path")
			if err != nil {
				return toolError(err)
			}

			status, _, err := client.GitAPI.GetStatus(ctx).Path(path).Execute()
			if err != nil {
				return toolError(err)
			}
			return toolSuccess(status)
		},
	)
}

// git_add stages files for commit.
func registerGitAdd(s *server.MCPServer, client *daemon.APIClient) {
	s.AddTool(
		mcp.NewTool("git_add",
			mcp.WithDescription("Add files to the Git staging area. Use '.' to stage all files."),
			mcp.WithString("path",
				mcp.Required(),
				mcp.Description("Repository path"),
			),
			mcp.WithObject("files",
				mcp.Required(),
				mcp.Description("Files to stage (JSON array of strings, use [\".\"] for all)"),
			),
		),
		func(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
			path, err := req.RequireString("path")
			if err != nil {
				return toolError(err)
			}

			files, err := getStringArrayArg(req, "files", true)
			if err != nil {
				return toolErrorMsg(err.Error())
			}

			addReq := daemon.GitAddRequest{
				Path:  path,
				Files: files,
			}

			_, err = client.GitAPI.AddFiles(ctx).Request(addReq).Execute()
			if err != nil {
				return toolError(err)
			}
			return toolOK()
		},
	)
}

// git_commit commits staged changes.
func registerGitCommit(s *server.MCPServer, client *daemon.APIClient) {
	s.AddTool(
		mcp.NewTool("git_commit",
			mcp.WithDescription("Commit staged changes to the Git repository."),
			mcp.WithString("path",
				mcp.Required(),
				mcp.Description("Repository path"),
			),
			mcp.WithString("message",
				mcp.Required(),
				mcp.Description("Commit message"),
			),
			mcp.WithString("author",
				mcp.Required(),
				mcp.Description("Author name"),
			),
			mcp.WithString("email",
				mcp.Required(),
				mcp.Description("Author email"),
			),
			mcp.WithBoolean("allow_empty",
				mcp.Description("Allow empty commits (default: false)"),
			),
		),
		func(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
			path, err := req.RequireString("path")
			if err != nil {
				return toolError(err)
			}
			message, err := req.RequireString("message")
			if err != nil {
				return toolError(err)
			}
			author, err := req.RequireString("author")
			if err != nil {
				return toolError(err)
			}
			email, err := req.RequireString("email")
			if err != nil {
				return toolError(err)
			}

			commitReq := daemon.GitCommitRequest{
				Path:    path,
				Message: message,
				Author:  author,
				Email:   email,
			}

			allowEmpty, err := req.RequireBool("allow_empty")
			if err == nil {
				commitReq.AllowEmpty = boolPtr(allowEmpty)
			}

			result, _, err := client.GitAPI.CommitChanges(ctx).Request(commitReq).Execute()
			if err != nil {
				return toolError(err)
			}
			return toolSuccess(result)
		},
	)
}

// git_branches lists all branches in a repository.
func registerGitBranches(s *server.MCPServer, client *daemon.APIClient) {
	s.AddTool(
		mcp.NewTool("git_branches",
			mcp.WithDescription("List all branches in a Git repository."),
			mcp.WithString("path",
				mcp.Required(),
				mcp.Description("Repository path"),
			),
		),
		func(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
			path, err := req.RequireString("path")
			if err != nil {
				return toolError(err)
			}

			result, _, err := client.GitAPI.ListBranches(ctx).Path(path).Execute()
			if err != nil {
				return toolError(err)
			}
			return toolSuccess(result)
		},
	)
}

// git_checkout checks out a branch or commit.
func registerGitCheckout(s *server.MCPServer, client *daemon.APIClient) {
	s.AddTool(
		mcp.NewTool("git_checkout",
			mcp.WithDescription("Switch to a different branch or commit."),
			mcp.WithString("path",
				mcp.Required(),
				mcp.Description("Repository path"),
			),
			mcp.WithString("branch",
				mcp.Required(),
				mcp.Description("Branch name or commit hash to checkout"),
			),
		),
		func(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
			path, err := req.RequireString("path")
			if err != nil {
				return toolError(err)
			}
			branch, err := req.RequireString("branch")
			if err != nil {
				return toolError(err)
			}

			checkoutReq := daemon.GitCheckoutRequest{
				Path:   path,
				Branch: branch,
			}

			_, err = client.GitAPI.CheckoutBranch(ctx).Request(checkoutReq).Execute()
			if err != nil {
				return toolError(err)
			}
			return toolOK()
		},
	)
}

// git_create_branch creates a new branch.
func registerGitCreateBranch(s *server.MCPServer, client *daemon.APIClient) {
	s.AddTool(
		mcp.NewTool("git_create_branch",
			mcp.WithDescription("Create a new branch in a Git repository."),
			mcp.WithString("path",
				mcp.Required(),
				mcp.Description("Repository path"),
			),
			mcp.WithString("name",
				mcp.Required(),
				mcp.Description("New branch name"),
			),
		),
		func(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
			path, err := req.RequireString("path")
			if err != nil {
				return toolError(err)
			}
			name, err := req.RequireString("name")
			if err != nil {
				return toolError(err)
			}

			branchReq := daemon.GitBranchRequest{
				Path: path,
				Name: name,
			}

			_, err = client.GitAPI.CreateBranch(ctx).Request(branchReq).Execute()
			if err != nil {
				return toolError(err)
			}
			return toolOK()
		},
	)
}

// git_pull pulls changes from the remote.
func registerGitPull(s *server.MCPServer, client *daemon.APIClient) {
	s.AddTool(
		mcp.NewTool("git_pull",
			mcp.WithDescription("Pull changes from the remote Git repository."),
			mcp.WithString("path",
				mcp.Required(),
				mcp.Description("Repository path"),
			),
			mcp.WithString("username",
				mcp.Description("Username for authentication (optional)"),
			),
			mcp.WithString("password",
				mcp.Description("Password for authentication (optional)"),
			),
		),
		func(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
			path, err := req.RequireString("path")
			if err != nil {
				return toolError(err)
			}

			pullReq := daemon.GitRepoRequest{
				Path: path,
			}
			if username := req.GetString("username", ""); username != "" {
				pullReq.Username = stringPtr(username)
			}
			if password := req.GetString("password", ""); password != "" {
				pullReq.Password = stringPtr(password)
			}

			_, err = client.GitAPI.PullChanges(ctx).Request(pullReq).Execute()
			if err != nil {
				return toolError(err)
			}
			return toolOK()
		},
	)
}

// git_push pushes changes to the remote.
func registerGitPush(s *server.MCPServer, client *daemon.APIClient) {
	s.AddTool(
		mcp.NewTool("git_push",
			mcp.WithDescription("Push local changes to the remote Git repository."),
			mcp.WithString("path",
				mcp.Required(),
				mcp.Description("Repository path"),
			),
			mcp.WithString("username",
				mcp.Description("Username for authentication (optional)"),
			),
			mcp.WithString("password",
				mcp.Description("Password for authentication (optional)"),
			),
		),
		func(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
			path, err := req.RequireString("path")
			if err != nil {
				return toolError(err)
			}

			pushReq := daemon.GitRepoRequest{
				Path: path,
			}
			if username := req.GetString("username", ""); username != "" {
				pushReq.Username = stringPtr(username)
			}
			if password := req.GetString("password", ""); password != "" {
				pushReq.Password = stringPtr(password)
			}

			_, err = client.GitAPI.PushChanges(ctx).Request(pushReq).Execute()
			if err != nil {
				return toolError(err)
			}
			return toolOK()
		},
	)
}
