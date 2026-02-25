package api

import (
	"net/rpc"

	"github.com/hashicorp/go-plugin"
)

// PluginInterface defines the interface that the computeruse plugin must implement
type IComputerUse interface {
	// Process management
	Initialize() (*Empty, error)
	Start() (*Empty, error)
	Stop() (*Empty, error)
	GetProcessStatus() (map[string]ProcessStatus, error)
	IsProcessRunning(req *ProcessRequest) (bool, error)
	RestartProcess(req *ProcessRequest) (*Empty, error)
	GetProcessLogs(req *ProcessRequest) (string, error)
	GetProcessErrors(req *ProcessRequest) (string, error)

	// Browser control methods
	OpenBrowser(*BrowserOpenRequest) (*Empty, error)
	CloseBrowser() (*Empty, error)

	// Screenshot methods
	TakeScreenshot(*ScreenshotRequest) (*ScreenshotResponse, error)
	TakeRegionScreenshot(*RegionScreenshotRequest) (*ScreenshotResponse, error)
	TakeCompressedScreenshot(*CompressedScreenshotRequest) (*ScreenshotResponse, error)
	TakeCompressedRegionScreenshot(*CompressedRegionScreenshotRequest) (*ScreenshotResponse, error)

	// Mouse control methods
	GetMousePosition() (*MousePositionResponse, error)
	MoveMouse(*MouseMoveRequest) (*MousePositionResponse, error)
	Click(*MouseClickRequest) (*MouseClickResponse, error)
	Drag(*MouseDragRequest) (*MouseDragResponse, error)
	Scroll(*MouseScrollRequest) (*ScrollResponse, error)

	// Keyboard control methods
	TypeText(*KeyboardTypeRequest) (*Empty, error)
	PressKey(*KeyboardPressRequest) (*Empty, error)
	PressHotkey(*KeyboardHotkeyRequest) (*Empty, error)

	// Display info methods
	GetDisplayInfo() (*DisplayInfoResponse, error)
	GetWindows() (*WindowsResponse, error)

	// Status method
	GetStatus() (*ComputerUseStatusResponse, error)
}

var ComputerUseHandshakeConfig = plugin.HandshakeConfig{
	ProtocolVersion:  1,
	MagicCookieKey:   "DECK_COMPUTER_USE_PLUGIN",
	MagicCookieValue: "deck_computer_use",
}

type ComputerUsePlugin struct {
	Impl IComputerUse
}

func (p *ComputerUsePlugin) Server(*plugin.MuxBroker) (any, error) {
	return &ComputerUseRPCServer{Impl: p.Impl}, nil
}

func (p *ComputerUsePlugin) Client(b *plugin.MuxBroker, c *rpc.Client) (any, error) {
	return &ComputerUseRPCClient{client: c}, nil
}
