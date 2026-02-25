package tools

import (
	"context"

	"github.com/cofy-x/deck/packages/client-daemon-go/daemon"
	"github.com/mark3labs/mcp-go/mcp"
	"github.com/mark3labs/mcp-go/server"
)

// RegisterComputerUseTools registers computer-use MCP tools (mouse, keyboard, screenshots, browser).
func RegisterComputerUseTools(s *server.MCPServer, client *daemon.APIClient) {
	registerScreenshot(s, client)
	registerMouseClick(s, client)
	registerMouseMove(s, client)
	registerMouseDrag(s, client)
	registerMouseScroll(s, client)
	registerKeyboardType(s, client)
	registerKeyboardPress(s, client)
	registerKeyboardHotkey(s, client)
	registerOpenBrowser(s, client)
	registerGetDisplayInfo(s, client)
	registerGetWindows(s, client)
}

// screenshot takes a screenshot of the screen with optional compression settings.
func registerScreenshot(s *server.MCPServer, client *daemon.APIClient) {
	s.AddTool(
		mcp.NewTool("screenshot",
			mcp.WithDescription("Take a screenshot of the screen. Returns a base64-encoded image. Supports compression options for reduced size."),
			mcp.WithString("format",
				mcp.Description("Image format: 'png' or 'jpeg' (default: png)"),
			),
			mcp.WithNumber("quality",
				mcp.Description("JPEG quality 1-100 (only for jpeg format)"),
			),
			mcp.WithNumber("scale",
				mcp.Description("Scale factor 0.1-1.0 (default: 1.0)"),
			),
			mcp.WithBoolean("show_cursor",
				mcp.Description("Whether to show the cursor in the screenshot (default: false)"),
			),
		),
		func(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
			apiReq := client.ComputerUseAPI.TakeCompressedScreenshot(ctx)

			if format := req.GetString("format", ""); format != "" {
				apiReq = apiReq.Format(format)
			}
			if quality := req.GetFloat("quality", 0); quality > 0 {
				apiReq = apiReq.Quality(int32(quality))
			}
			if scale := req.GetFloat("scale", 0); scale > 0 {
				apiReq = apiReq.Scale(float32(scale))
			}
			showCursor, err := req.RequireBool("show_cursor")
			if err == nil {
				apiReq = apiReq.ShowCursor(showCursor)
			}

			result, _, err := apiReq.Execute()
			if err != nil {
				return toolError(err)
			}
			return toolSuccess(result)
		},
	)
}

// mouse_click clicks a mouse button at the specified coordinates.
func registerMouseClick(s *server.MCPServer, client *daemon.APIClient) {
	s.AddTool(
		mcp.NewTool("mouse_click",
			mcp.WithDescription("Click a mouse button at the specified screen coordinates."),
			mcp.WithNumber("x",
				mcp.Required(),
				mcp.Description("X coordinate"),
			),
			mcp.WithNumber("y",
				mcp.Required(),
				mcp.Description("Y coordinate"),
			),
			mcp.WithString("button",
				mcp.Description("Mouse button: 'left', 'right', or 'middle' (default: left)"),
			),
			mcp.WithBoolean("double",
				mcp.Description("Whether to double-click (default: false)"),
			),
		),
		func(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
			x, err := req.RequireFloat("x")
			if err != nil {
				return toolError(err)
			}
			y, err := req.RequireFloat("y")
			if err != nil {
				return toolError(err)
			}

			clickReq := daemon.MouseClickRequest{
				X: int32Ptr(int32(x)),
				Y: int32Ptr(int32(y)),
			}

			if button := req.GetString("button", ""); button != "" {
				clickReq.Button = stringPtr(button)
			}
			double, err := req.RequireBool("double")
			if err == nil {
				clickReq.Double = boolPtr(double)
			}

			result, _, err := client.ComputerUseAPI.Click(ctx).Request(clickReq).Execute()
			if err != nil {
				return toolError(err)
			}
			return toolSuccess(result)
		},
	)
}

// mouse_move moves the mouse cursor to the specified coordinates.
func registerMouseMove(s *server.MCPServer, client *daemon.APIClient) {
	s.AddTool(
		mcp.NewTool("mouse_move",
			mcp.WithDescription("Move the mouse cursor to the specified screen coordinates."),
			mcp.WithNumber("x",
				mcp.Required(),
				mcp.Description("X coordinate"),
			),
			mcp.WithNumber("y",
				mcp.Required(),
				mcp.Description("Y coordinate"),
			),
		),
		func(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
			x, err := req.RequireFloat("x")
			if err != nil {
				return toolError(err)
			}
			y, err := req.RequireFloat("y")
			if err != nil {
				return toolError(err)
			}

			moveReq := daemon.MouseMoveRequest{
				X: int32Ptr(int32(x)),
				Y: int32Ptr(int32(y)),
			}

			result, _, err := client.ComputerUseAPI.MoveMouse(ctx).Request(moveReq).Execute()
			if err != nil {
				return toolError(err)
			}
			return toolSuccess(result)
		},
	)
}

// mouse_drag drags the mouse from one position to another.
func registerMouseDrag(s *server.MCPServer, client *daemon.APIClient) {
	s.AddTool(
		mcp.NewTool("mouse_drag",
			mcp.WithDescription("Drag the mouse from a start position to an end position."),
			mcp.WithNumber("start_x",
				mcp.Required(),
				mcp.Description("Start X coordinate"),
			),
			mcp.WithNumber("start_y",
				mcp.Required(),
				mcp.Description("Start Y coordinate"),
			),
			mcp.WithNumber("end_x",
				mcp.Required(),
				mcp.Description("End X coordinate"),
			),
			mcp.WithNumber("end_y",
				mcp.Required(),
				mcp.Description("End Y coordinate"),
			),
			mcp.WithString("button",
				mcp.Description("Mouse button: 'left', 'right', or 'middle' (default: left)"),
			),
		),
		func(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
			startX, err := req.RequireFloat("start_x")
			if err != nil {
				return toolError(err)
			}
			startY, err := req.RequireFloat("start_y")
			if err != nil {
				return toolError(err)
			}
			endX, err := req.RequireFloat("end_x")
			if err != nil {
				return toolError(err)
			}
			endY, err := req.RequireFloat("end_y")
			if err != nil {
				return toolError(err)
			}

			dragReq := daemon.MouseDragRequest{
				StartX: int32Ptr(int32(startX)),
				StartY: int32Ptr(int32(startY)),
				EndX:   int32Ptr(int32(endX)),
				EndY:   int32Ptr(int32(endY)),
			}

			if button := req.GetString("button", ""); button != "" {
				dragReq.Button = stringPtr(button)
			}

			result, _, err := client.ComputerUseAPI.Drag(ctx).Request(dragReq).Execute()
			if err != nil {
				return toolError(err)
			}
			return toolSuccess(result)
		},
	)
}

// mouse_scroll scrolls the mouse wheel at the specified position.
func registerMouseScroll(s *server.MCPServer, client *daemon.APIClient) {
	s.AddTool(
		mcp.NewTool("mouse_scroll",
			mcp.WithDescription("Scroll the mouse wheel at the specified position."),
			mcp.WithNumber("x",
				mcp.Required(),
				mcp.Description("X coordinate"),
			),
			mcp.WithNumber("y",
				mcp.Required(),
				mcp.Description("Y coordinate"),
			),
			mcp.WithString("direction",
				mcp.Required(),
				mcp.Description("Scroll direction: 'up' or 'down'"),
				mcp.Enum("up", "down"),
			),
			mcp.WithNumber("amount",
				mcp.Description("Scroll amount (default: 3)"),
			),
		),
		func(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
			x, err := req.RequireFloat("x")
			if err != nil {
				return toolError(err)
			}
			y, err := req.RequireFloat("y")
			if err != nil {
				return toolError(err)
			}
			direction, err := req.RequireString("direction")
			if err != nil {
				return toolError(err)
			}

			scrollReq := daemon.MouseScrollRequest{
				X:         int32Ptr(int32(x)),
				Y:         int32Ptr(int32(y)),
				Direction: stringPtr(direction),
			}

			if amount := req.GetFloat("amount", 0); amount > 0 {
				scrollReq.Amount = int32Ptr(int32(amount))
			}

			result, _, err := client.ComputerUseAPI.Scroll(ctx).Request(scrollReq).Execute()
			if err != nil {
				return toolError(err)
			}
			return toolSuccess(result)
		},
	)
}

// keyboard_type types a string of text.
func registerKeyboardType(s *server.MCPServer, client *daemon.APIClient) {
	s.AddTool(
		mcp.NewTool("keyboard_type",
			mcp.WithDescription("Type a string of text using the keyboard."),
			mcp.WithString("text",
				mcp.Required(),
				mcp.Description("Text to type"),
			),
			mcp.WithNumber("delay",
				mcp.Description("Delay in milliseconds between keystrokes (optional)"),
			),
		),
		func(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
			text, err := req.RequireString("text")
			if err != nil {
				return toolError(err)
			}

			typeReq := daemon.KeyboardTypeRequest{
				Text: stringPtr(text),
			}

			if delay := req.GetFloat("delay", 0); delay > 0 {
				typeReq.Delay = int32Ptr(int32(delay))
			}

			_, _, err = client.ComputerUseAPI.TypeText(ctx).Request(typeReq).Execute()
			if err != nil {
				return toolError(err)
			}
			return toolOK()
		},
	)
}

// keyboard_press presses a single key with optional modifiers.
func registerKeyboardPress(s *server.MCPServer, client *daemon.APIClient) {
	s.AddTool(
		mcp.NewTool("keyboard_press",
			mcp.WithDescription("Press a single key with optional modifiers (ctrl, alt, shift, cmd)."),
			mcp.WithString("key",
				mcp.Required(),
				mcp.Description("Key to press (e.g., 'Return', 'Tab', 'Escape', 'a', 'F1')"),
			),
			mcp.WithObject("modifiers",
				mcp.Description("Modifier keys as a JSON array (e.g., [\"ctrl\", \"shift\"])"),
			),
		),
		func(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
			key, err := req.RequireString("key")
			if err != nil {
				return toolError(err)
			}

			pressReq := daemon.KeyboardPressRequest{
				Key: stringPtr(key),
			}

			mods, err := getStringArrayArg(req, "modifiers", false)
			if err != nil {
				return toolErrorMsg(err.Error())
			}
			if len(mods) > 0 {
				pressReq.Modifiers = mods
			}

			_, _, err = client.ComputerUseAPI.PressKey(ctx).Request(pressReq).Execute()
			if err != nil {
				return toolError(err)
			}
			return toolOK()
		},
	)
}

// keyboard_hotkey presses a hotkey combination.
func registerKeyboardHotkey(s *server.MCPServer, client *daemon.APIClient) {
	s.AddTool(
		mcp.NewTool("keyboard_hotkey",
			mcp.WithDescription("Press a hotkey combination (e.g., 'ctrl+c', 'cmd+v', 'ctrl+shift+t')."),
			mcp.WithString("keys",
				mcp.Required(),
				mcp.Description("Hotkey combination string (e.g., 'ctrl+c', 'cmd+v')"),
			),
		),
		func(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
			keys, err := req.RequireString("keys")
			if err != nil {
				return toolError(err)
			}

			hotkeyReq := daemon.KeyboardHotkeyRequest{
				Keys: stringPtr(keys),
			}

			_, _, err = client.ComputerUseAPI.PressHotkey(ctx).Request(hotkeyReq).Execute()
			if err != nil {
				return toolError(err)
			}
			return toolOK()
		},
	)
}

// open_browser opens a URL in the browser.
func registerOpenBrowser(s *server.MCPServer, client *daemon.APIClient) {
	s.AddTool(
		mcp.NewTool("open_browser",
			mcp.WithDescription("Open a URL in the browser or navigate if already open."),
			mcp.WithString("url",
				mcp.Required(),
				mcp.Description("URL to open"),
			),
			mcp.WithBoolean("incognito",
				mcp.Description("Open in incognito mode (default: false)"),
			),
		),
		func(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
			url, err := req.RequireString("url")
			if err != nil {
				return toolError(err)
			}

			openReq := daemon.BrowserOpenRequest{
				Url: stringPtr(url),
			}

			incognito, err := req.RequireBool("incognito")
			if err == nil {
				openReq.Incognito = boolPtr(incognito)
			}

			_, _, err = client.ComputerUseAPI.OpenBrowser(ctx).Request(openReq).Execute()
			if err != nil {
				return toolError(err)
			}
			return toolOK()
		},
	)
}

// get_display_info returns information about available displays.
func registerGetDisplayInfo(s *server.MCPServer, client *daemon.APIClient) {
	s.AddTool(
		mcp.NewTool("get_display_info",
			mcp.WithDescription("Get information about available displays (screen dimensions, resolution)."),
		),
		func(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
			result, _, err := client.ComputerUseAPI.GetDisplayInfo(ctx).Execute()
			if err != nil {
				return toolError(err)
			}
			return toolSuccess(result)
		},
	)
}

// get_windows returns information about all open windows.
func registerGetWindows(s *server.MCPServer, client *daemon.APIClient) {
	s.AddTool(
		mcp.NewTool("get_windows",
			mcp.WithDescription("Get information about all open windows on the desktop."),
		),
		func(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
			result, _, err := client.ComputerUseAPI.GetWindows(ctx).Execute()
			if err != nil {
				return toolError(err)
			}
			return toolSuccess(result)
		},
	)
}
