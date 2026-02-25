package api

// Common structs for better composition
type Position struct {
	X int `json:"x"`
	Y int `json:"y"`
} //	@name	Position

type Size struct {
	Width  int `json:"width"`
	Height int `json:"height"`
} //	@name	Size

// Screenshot parameter structs
type ScreenshotRequest struct {
	ShowCursor bool `json:"showCursor"`
} //	@name	ScreenshotRequest

type RegionScreenshotRequest struct {
	Position
	Size
	ShowCursor bool `json:"showCursor"`
} //	@name	RegionScreenshotRequest

type CompressedScreenshotRequest struct {
	ShowCursor bool    `json:"showCursor"`
	Format     string  `json:"format"`  // "png" or "jpeg"
	Quality    int     `json:"quality"` // 1-100 for JPEG quality
	Scale      float64 `json:"scale"`   // 0.1-1.0 for scaling down
} //	@name	CompressedScreenshotRequest

type CompressedRegionScreenshotRequest struct {
	Position
	Size
	ShowCursor bool    `json:"showCursor"`
	Format     string  `json:"format"`  // "png" or "jpeg"
	Quality    int     `json:"quality"` // 1-100 for JPEG quality
	Scale      float64 `json:"scale"`   // 0.1-1.0 for scaling down
} //	@name	CompressedRegionScreenshotRequest

// Mouse parameter structs
type MouseMoveRequest struct {
	Position
} //	@name	MouseMoveRequest

type MouseClickRequest struct {
	Position
	Button string `json:"button"` // left, right, middle
	Double bool   `json:"double"`
} //	@name	MouseClickRequest

type MouseDragRequest struct {
	StartX int    `json:"startX"`
	StartY int    `json:"startY"`
	EndX   int    `json:"endX"`
	EndY   int    `json:"endY"`
	Button string `json:"button"`
} //	@name	MouseDragRequest

type MouseScrollRequest struct {
	Position
	Direction string `json:"direction"` // up, down
	Amount    int    `json:"amount"`
} //	@name	MouseScrollRequest

// Keyboard parameter structs
type KeyboardTypeRequest struct {
	Text  string `json:"text"`
	Delay int    `json:"delay"` // milliseconds between keystrokes
} //	@name	KeyboardTypeRequest

type KeyboardPressRequest struct {
	Key       string   `json:"key"`
	Modifiers []string `json:"modifiers"` // ctrl, alt, shift, cmd
} //	@name	KeyboardPressRequest

type KeyboardHotkeyRequest struct {
	Keys string `json:"keys"` // e.g., "ctrl+c", "cmd+v"
} //	@name	KeyboardHotkeyRequest

// Response structs for keyboard operations
type ScrollResponse struct {
	Success bool `json:"success"`
} //	@name	ScrollResponse

// Response structs
type ScreenshotResponse struct {
	Screenshot     string    `json:"screenshot"`
	CursorPosition *Position `json:"cursorPosition,omitempty"`
	SizeBytes      int       `json:"sizeBytes,omitempty"`
} //	@name	ScreenshotResponse

// Mouse response structs - separated by operation type
type MousePositionResponse struct {
	Position
} //	@name	MousePositionResponse

type MouseClickResponse struct {
	Position
} //	@name	MouseClickResponse

type MouseDragResponse struct {
	Position // Final position
} //	@name	MouseDragResponse

type DisplayInfoResponse struct {
	Displays []DisplayInfo `json:"displays"`
} //	@name	DisplayInfoResponse

type DisplayInfo struct {
	ID int `json:"id"`
	Position
	Size
	IsActive bool `json:"isActive"`
} //	@name	DisplayInfo

type WindowsResponse struct {
	Windows []WindowInfo `json:"windows"`
} //	@name	WindowsResponse

type WindowInfo struct {
	ID    int    `json:"id"`
	Title string `json:"title"`
	Position
	Size
	IsActive bool `json:"isActive"`
} //	@name	WindowInfo

type ComputerUseStatusResponse struct {
	Status string `json:"status"`
} //	@name	ComputerUseStatusResponse

type ComputerUseStartResponse struct {
	Message string                   `json:"message"`
	Status  map[string]ProcessStatus `json:"status"`
} //	@name	ComputerUseStartResponse

type ComputerUseStopResponse struct {
	Message string                   `json:"message"`
	Status  map[string]ProcessStatus `json:"status"`
} //	@name	ComputerUseStopResponse

type ProcessStatus struct {
	Running     bool
	Priority    int
	AutoRestart bool
	Pid         *int
} //	@name	ProcessStatus

type ProcessStatusResponse struct {
	ProcessName string `json:"processName"`
	Running     bool   `json:"running"`
} //	@name	ProcessStatusResponse

type ProcessRestartResponse struct {
	Message     string `json:"message"`
	ProcessName string `json:"processName"`
} //	@name	ProcessRestartResponse

type ProcessLogsResponse struct {
	ProcessName string `json:"processName"`
	Logs        string `json:"logs"`
} //	@name	ProcessLogsResponse

type ProcessErrorsResponse struct {
	ProcessName string `json:"processName"`
	Errors      string `json:"errors"`
} //	@name	ProcessErrorsResponse

type ProcessRequest struct {
	ProcessName string
} //	@name	ProcessRequest

type Empty struct{} //	@name	Empty

// Browser parameter structs
type BrowserOpenRequest struct {
	Url         string `json:"url"`
	Incognito   bool   `json:"incognito"`   // Whether to use incognito mode
	RemoteDebug bool   `json:"remoteDebug"` // Whether to open the 9222 debug port
} //    @name   BrowserOpenRequest
