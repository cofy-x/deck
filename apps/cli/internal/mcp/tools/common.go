package tools

import (
	"encoding/json"
	"errors"
	"fmt"
	"os"

	"github.com/cofy-x/deck/packages/client-daemon-go/daemon"
	"github.com/mark3labs/mcp-go/mcp"
)

// toJSON marshals v to a JSON string for tool result output.
// If marshalling fails it returns a fallback error JSON.
func toJSON(v any) string {
	b, err := json.MarshalIndent(v, "", "  ")
	if err != nil {
		return fmt.Sprintf(`{"error":"failed to marshal response: %s"}`, err.Error())
	}
	return string(b)
}

// toolError converts a daemon API error into an MCP tool error result.
// It extracts the human-readable message from GenericOpenAPIError when possible.
func toolError(err error) (*mcp.CallToolResult, error) {
	msg := extractErrorMessage(err)
	return mcp.NewToolResultError(msg), nil
}

// toolErrorMsg returns an MCP tool error result with a plain message.
func toolErrorMsg(msg string) (*mcp.CallToolResult, error) {
	return mcp.NewToolResultError(msg), nil
}

// toolSuccess returns a success result wrapping a JSON-serialized value.
func toolSuccess(v any) (*mcp.CallToolResult, error) {
	return mcp.NewToolResultText(toJSON(v)), nil
}

// toolSuccessText returns a success result with plain text.
func toolSuccessText(text string) (*mcp.CallToolResult, error) {
	return mcp.NewToolResultText(text), nil
}

// toolOK returns a simple success acknowledgement (for void-returning API calls).
func toolOK() (*mcp.CallToolResult, error) {
	return mcp.NewToolResultText(`{"status":"ok"}`), nil
}

// extractErrorMessage pulls the most useful message from a daemon API error.
func extractErrorMessage(err error) string {
	var apiErr *daemon.GenericOpenAPIError
	if errors.As(err, &apiErr) {
		body := string(apiErr.Body())
		if body != "" {
			return fmt.Sprintf("%s: %s", apiErr.Error(), body)
		}
		return apiErr.Error()
	}
	return err.Error()
}

// int32Ptr returns a pointer to the given int32 value.
func int32Ptr(v int32) *int32 {
	return &v
}

// float32Ptr returns a pointer to the given float32 value.
func float32Ptr(v float32) *float32 {
	return &v
}

// stringPtr returns a pointer to the given string value.
func stringPtr(v string) *string {
	return &v
}

// boolPtr returns a pointer to the given bool value.
func boolPtr(v bool) *bool {
	return &v
}

// createTempFile creates a temporary file with the given content and returns
// the file handle positioned at the start, ready for reading.
func createTempFile(content string) (*os.File, error) {
	tmpFile, err := os.CreateTemp("", "deck-upload-*")
	if err != nil {
		return nil, fmt.Errorf("create temp file: %w", err)
	}

	if _, err := tmpFile.WriteString(content); err != nil {
		tmpFile.Close()
		os.Remove(tmpFile.Name())
		return nil, fmt.Errorf("write temp file: %w", err)
	}

	if _, err := tmpFile.Seek(0, 0); err != nil {
		tmpFile.Close()
		os.Remove(tmpFile.Name())
		return nil, fmt.Errorf("seek temp file: %w", err)
	}

	return tmpFile, nil
}

// removeTempFile closes and removes a temporary file.
func removeTempFile(f *os.File) {
	if f != nil {
		name := f.Name()
		f.Close()
		os.Remove(name)
	}
}

// getStringArrayArg extracts a string array argument from an MCP request.
func getStringArrayArg(req mcp.CallToolRequest, name string, required bool) ([]string, error) {
	args := req.GetArguments()
	raw, ok := args[name]
	if !ok {
		if required {
			return nil, fmt.Errorf("%s parameter is required", name)
		}
		return nil, nil
	}

	switch v := raw.(type) {
	case []string:
		return v, nil
	case []any:
		values := make([]string, 0, len(v))
		for _, item := range v {
			s, ok := item.(string)
			if !ok {
				return nil, fmt.Errorf("%s must be an array of strings", name)
			}
			values = append(values, s)
		}
		return values, nil
	default:
		return nil, fmt.Errorf("%s must be an array of strings", name)
	}
}
