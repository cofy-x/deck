package computeruse

import (
	"net/http"
	"strconv"

	"github.com/cofy-x/deck/packages/computer-use/api"
	"github.com/gin-gonic/gin"
)

// TakeScreenshot godoc
//
//	@Summary		Take a screenshot
//	@Description	Take a screenshot of the entire screen
//	@Tags			computer-use
//	@Produce		json
//	@Param			showCursor	query		bool	false	"Whether to show cursor in screenshot"
//	@Success		200			{object}	api.ScreenshotResponse
//	@Router			/computeruse/screenshot [get]
//
//	@id				TakeScreenshot
func WrapScreenshotHandler(fn func(*api.ScreenshotRequest) (*api.ScreenshotResponse, error)) gin.HandlerFunc {
	return func(c *gin.Context) {
		req := &api.ScreenshotRequest{
			ShowCursor: c.Query("showCursor") == "true",
		}
		response, err := fn(req)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusOK, response)
	}
}

// TakeRegionScreenshot godoc
//
//	@Summary		Take a region screenshot
//	@Description	Take a screenshot of a specific region of the screen
//	@Tags			computer-use
//	@Produce		json
//	@Param			x			query		int		true	"X coordinate of the region"
//	@Param			y			query		int		true	"Y coordinate of the region"
//	@Param			width		query		int		true	"Width of the region"
//	@Param			height		query		int		true	"Height of the region"
//	@Param			showCursor	query		bool	false	"Whether to show cursor in screenshot"
//	@Success		200			{object}	api.ScreenshotResponse
//	@Router			/computeruse/screenshot/region [get]
//
//	@id				TakeRegionScreenshot
func WrapRegionScreenshotHandler(fn func(*api.RegionScreenshotRequest) (*api.ScreenshotResponse, error)) gin.HandlerFunc {
	return func(c *gin.Context) {
		var req api.RegionScreenshotRequest
		if err := c.ShouldBindQuery(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid parameters"})
			return
		}
		req.ShowCursor = c.Query("showCursor") == "true"

		response, err := fn(&req)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusOK, response)
	}
}

// TakeCompressedScreenshot godoc
//
//	@Summary		Take a compressed screenshot
//	@Description	Take a compressed screenshot of the entire screen
//	@Tags			computer-use
//	@Produce		json
//	@Param			showCursor	query		bool	false	"Whether to show cursor in screenshot"
//	@Param			format		query		string	false	"Image format (png or jpeg)"
//	@Param			quality		query		int		false	"JPEG quality (1-100)"
//	@Param			scale		query		float64	false	"Scale factor (0.1-1.0)"
//	@Success		200			{object}	api.ScreenshotResponse
//	@Router			/computeruse/screenshot/compressed [get]
//
//	@id				TakeCompressedScreenshot
func WrapCompressedScreenshotHandler(fn func(*api.CompressedScreenshotRequest) (*api.ScreenshotResponse, error)) gin.HandlerFunc {
	return func(c *gin.Context) {
		req := &api.CompressedScreenshotRequest{
			ShowCursor: c.Query("showCursor") == "true",
			Format:     c.Query("format"),
			Quality:    85,
			Scale:      1.0,
		}

		// Parse quality
		if qualityStr := c.Query("quality"); qualityStr != "" {
			if quality, err := strconv.Atoi(qualityStr); err == nil && quality >= 1 && quality <= 100 {
				req.Quality = quality
			}
		}

		// Parse scale
		if scaleStr := c.Query("scale"); scaleStr != "" {
			if scale, err := strconv.ParseFloat(scaleStr, 64); err == nil && scale >= 0.1 && scale <= 1.0 {
				req.Scale = scale
			}
		}

		response, err := fn(req)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusOK, response)
	}
}

// TakeCompressedRegionScreenshot godoc
//
//	@Summary		Take a compressed region screenshot
//	@Description	Take a compressed screenshot of a specific region of the screen
//	@Tags			computer-use
//	@Produce		json
//	@Param			x			query		int		true	"X coordinate of the region"
//	@Param			y			query		int		true	"Y coordinate of the region"
//	@Param			width		query		int		true	"Width of the region"
//	@Param			height		query		int		true	"Height of the region"
//	@Param			showCursor	query		bool	false	"Whether to show cursor in screenshot"
//	@Param			format		query		string	false	"Image format (png or jpeg)"
//	@Param			quality		query		int		false	"JPEG quality (1-100)"
//	@Param			scale		query		float64	false	"Scale factor (0.1-1.0)"
//	@Success		200			{object}	api.ScreenshotResponse
//	@Router			/computeruse/screenshot/region/compressed [get]
//
//	@id				TakeCompressedRegionScreenshot
func WrapCompressedRegionScreenshotHandler(fn func(*api.CompressedRegionScreenshotRequest) (*api.ScreenshotResponse, error)) gin.HandlerFunc {
	return func(c *gin.Context) {
		var req api.CompressedRegionScreenshotRequest
		if err := c.ShouldBindQuery(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid parameters"})
			return
		}
		req.ShowCursor = c.Query("showCursor") == "true"
		req.Format = c.Query("format")
		req.Quality = 85
		req.Scale = 1.0

		// Parse quality
		if qualityStr := c.Query("quality"); qualityStr != "" {
			if quality, err := strconv.Atoi(qualityStr); err == nil && quality >= 1 && quality <= 100 {
				req.Quality = quality
			}
		}

		// Parse scale
		if scaleStr := c.Query("scale"); scaleStr != "" {
			if scale, err := strconv.ParseFloat(scaleStr, 64); err == nil && scale >= 0.1 && scale <= 1.0 {
				req.Scale = scale
			}
		}

		response, err := fn(&req)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusOK, response)
	}
}

// GetMousePosition godoc
//
//	@Summary		Get mouse position
//	@Description	Get the current mouse cursor position
//	@Tags			computer-use
//	@Produce		json
//	@Success		200	{object}	api.MousePositionResponse
//	@Router			/computeruse/mouse/position [get]
//
//	@id				GetMousePosition
func WrapMousePositionHandler(fn func() (*api.MousePositionResponse, error)) gin.HandlerFunc {
	return func(c *gin.Context) {
		response, err := fn()
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusOK, response)
	}
}

// MoveMouse godoc
//
//	@Summary		Move mouse cursor
//	@Description	Move the mouse cursor to the specified coordinates
//	@Tags			computer-use
//	@Accept			json
//	@Produce		json
//	@Param			request	body		api.MouseMoveRequest	true	"Mouse move request"
//	@Success		200		{object}	api.MousePositionResponse
//	@Router			/computeruse/mouse/move [post]
//
//	@id				MoveMouse
func WrapMoveMouseHandler(fn func(*api.MouseMoveRequest) (*api.MousePositionResponse, error)) gin.HandlerFunc {
	return func(c *gin.Context) {
		var req api.MouseMoveRequest
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid coordinates"})
			return
		}

		response, err := fn(&req)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusOK, response)
	}
}

// Click godoc
//
//	@Summary		Click mouse button
//	@Description	Click the mouse button at the specified coordinates
//	@Tags			computer-use
//	@Accept			json
//	@Produce		json
//	@Param			request	body		api.MouseClickRequest	true	"Mouse click request"
//	@Success		200		{object}	api.MouseClickResponse
//	@Router			/computeruse/mouse/click [post]
//
//	@id				Click
func WrapClickHandler(fn func(*api.MouseClickRequest) (*api.MouseClickResponse, error)) gin.HandlerFunc {
	return func(c *gin.Context) {
		var req api.MouseClickRequest
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid click parameters"})
			return
		}

		response, err := fn(&req)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusOK, response)
	}
}

// Drag godoc
//
//	@Summary		Drag mouse
//	@Description	Drag the mouse from start to end coordinates
//	@Tags			computer-use
//	@Accept			json
//	@Produce		json
//	@Param			request	body		api.MouseDragRequest	true	"Mouse drag request"
//	@Success		200		{object}	api.MouseDragResponse
//	@Router			/computeruse/mouse/drag [post]
//
//	@id				Drag
func WrapDragHandler(fn func(*api.MouseDragRequest) (*api.MouseDragResponse, error)) gin.HandlerFunc {
	return func(c *gin.Context) {
		var req api.MouseDragRequest
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid drag parameters"})
			return
		}

		response, err := fn(&req)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusOK, response)
	}
}

// Scroll godoc
//
//	@Summary		Scroll mouse wheel
//	@Description	Scroll the mouse wheel at the specified coordinates
//	@Tags			computer-use
//	@Accept			json
//	@Produce		json
//	@Param			request	body		api.MouseScrollRequest	true	"Mouse scroll request"
//	@Success		200		{object}	api.ScrollResponse
//	@Router			/computeruse/mouse/scroll [post]
//
//	@id				Scroll
func WrapScrollHandler(fn func(*api.MouseScrollRequest) (*api.ScrollResponse, error)) gin.HandlerFunc {
	return func(c *gin.Context) {
		var req api.MouseScrollRequest
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid scroll parameters"})
			return
		}

		response, err := fn(&req)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusOK, response)
	}
}

// TypeText godoc
//
//	@Summary		Type text
//	@Description	Type text with optional delay between keystrokes
//	@Tags			computer-use
//	@Accept			json
//	@Produce		json
//	@Param			request	body		api.KeyboardTypeRequest	true	"Text typing request"
//	@Success		200		{object}	api.Empty
//	@Router			/computeruse/keyboard/type [post]
//
//	@id				TypeText
func WrapTypeTextHandler(fn func(*api.KeyboardTypeRequest) (*api.Empty, error)) gin.HandlerFunc {
	return func(c *gin.Context) {
		var req api.KeyboardTypeRequest
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid input"})
			return
		}

		response, err := fn(&req)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusOK, response)
	}
}

// PressKey godoc
//
//	@Summary		Press key
//	@Description	Press a key with optional modifiers
//	@Tags			computer-use
//	@Accept			json
//	@Produce		json
//	@Param			request	body		api.KeyboardPressRequest	true	"Key press request"
//	@Success		200		{object}	api.Empty
//	@Router			/computeruse/keyboard/key [post]
//
//	@id				PressKey
func WrapPressKeyHandler(fn func(*api.KeyboardPressRequest) (*api.Empty, error)) gin.HandlerFunc {
	return func(c *gin.Context) {
		var req api.KeyboardPressRequest
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid key"})
			return
		}

		response, err := fn(&req)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusOK, response)
	}
}

// PressHotkey godoc
//
//	@Summary		Press hotkey
//	@Description	Press a hotkey combination (e.g., ctrl+c, cmd+v)
//	@Tags			computer-use
//	@Accept			json
//	@Produce		json
//	@Param			request	body		api.KeyboardHotkeyRequest	true	"Hotkey press request"
//	@Success		200		{object}	api.Empty
//	@Router			/computeruse/keyboard/hotkey [post]
//
//	@id				PressHotkey
func WrapPressHotkeyHandler(fn func(*api.KeyboardHotkeyRequest) (*api.Empty, error)) gin.HandlerFunc {
	return func(c *gin.Context) {
		var req api.KeyboardHotkeyRequest
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid hotkey"})
			return
		}

		response, err := fn(&req)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusOK, response)
	}
}

// GetDisplayInfo godoc
//
//	@Summary		Get display information
//	@Description	Get information about all available displays
//	@Tags			computer-use
//	@Produce		json
//	@Success		200	{object}	api.DisplayInfoResponse
//	@Router			/computeruse/display/info [get]
//
//	@id				GetDisplayInfo
func WrapDisplayInfoHandler(fn func() (*api.DisplayInfoResponse, error)) gin.HandlerFunc {
	return func(c *gin.Context) {
		response, err := fn()
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusOK, response)
	}
}

// GetWindows godoc
//
//	@Summary		Get windows information
//	@Description	Get information about all open windows
//	@Tags			computer-use
//	@Produce		json
//	@Success		200	{object}	api.WindowsResponse
//	@Router			/computeruse/display/windows [get]
//
//	@id				GetWindows
func WrapWindowsHandler(fn func() (*api.WindowsResponse, error)) gin.HandlerFunc {
	return func(c *gin.Context) {
		response, err := fn()
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusOK, response)
	}
}

// GetStatus godoc
//
//	@Summary		Get computer use status
//	@Description	Get the current status of the computer use system
//	@Tags			computer-use
//	@Produce		json
//	@Success		200	{object}	api.ComputerUseStatusResponse
//	@Router			/computeruse/status [get]
//
//	@id				GetComputerUseSystemStatus
func WrapStatusHandler(fn func() (*api.ComputerUseStatusResponse, error)) gin.HandlerFunc {
	return func(c *gin.Context) {
		response, err := fn()
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusOK, response)
	}
}
