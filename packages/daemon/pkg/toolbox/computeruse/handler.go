package computeruse

import (
	"fmt"
	"net/http"

	"github.com/cofy-x/deck/packages/computer-use/api"
	"github.com/gin-gonic/gin"
)

type Handler struct {
	ComputerUse api.IComputerUse
}

// StartComputerUse godoc
//
//	@Summary		Start computer use processes
//	@Description	Start all computer use processes and return their status
//	@Tags			computer-use
//	@Produce		json
//	@Success		200	{object}	api.ComputerUseStartResponse
//	@Router			/computeruse/start [post]
//
//	@id				StartComputerUse
func (h *Handler) StartComputerUse(ctx *gin.Context) {
	_, err := h.ComputerUse.Start()
	if err != nil {
		ctx.JSON(http.StatusServiceUnavailable, gin.H{
			"error":   "Failed to start computer use",
			"details": err.Error(),
		})
		return
	}

	status, err := h.ComputerUse.GetProcessStatus()
	if err != nil {
		ctx.JSON(http.StatusServiceUnavailable, gin.H{
			"error":   "Failed to get computer use status",
			"details": err.Error(),
		})
		return
	}

	ctx.JSON(http.StatusOK, gin.H{
		"message": "Computer use processes started successfully",
		"status":  status,
	})
}

// StopComputerUse godoc
//
//	@Summary		Stop computer use processes
//	@Description	Stop all computer use processes and return their status
//	@Tags			computer-use
//	@Produce		json
//	@Success		200	{object}	api.ComputerUseStopResponse
//	@Router			/computeruse/stop [post]
//
//	@id				StopComputerUse
func (h *Handler) StopComputerUse(ctx *gin.Context) {
	_, err := h.ComputerUse.Stop()
	if err != nil {
		ctx.JSON(http.StatusServiceUnavailable, gin.H{
			"error":   "Failed to stop computer use",
			"details": err.Error(),
		})
		return
	}

	status, err := h.ComputerUse.GetProcessStatus()
	if err != nil {
		ctx.JSON(http.StatusServiceUnavailable, gin.H{
			"error":   "Failed to get computer use status",
			"details": err.Error(),
		})
		return
	}
	ctx.JSON(http.StatusOK, gin.H{
		"message": "Computer use processes stopped successfully",
		"status":  status,
	})
}

// GetComputerUseStatus godoc
//
//	@Summary		Get computer use process status
//	@Description	Get the status of all computer use processes
//	@Tags			computer-use
//	@Produce		json
//	@Success		200	{object}	api.ComputerUseStatusResponse
//	@Router			/computeruse/process-status [get]
//
//	@id				GetComputerUseStatus
func (h *Handler) GetComputerUseStatus(ctx *gin.Context) {
	status, err := h.ComputerUse.GetStatus()
	if err != nil {
		ctx.JSON(http.StatusServiceUnavailable, gin.H{
			"error":   "Failed to get computer use status",
			"details": err.Error(),
		})
		return
	}
	if status == nil {
		ctx.JSON(http.StatusOK, gin.H{
			"status": "unknown",
		})
		return
	}
	ctx.JSON(http.StatusOK, *status)
}

// GetProcessStatus godoc
//
//	@Summary		Get specific process status
//	@Description	Check if a specific computer use process is running
//	@Tags			computer-use
//	@Produce		json
//	@Param			processName	path		string	true	"Process name to check"
//	@Success		200			{object}	api.ProcessStatusResponse
//	@Router			/computeruse/process/{processName}/status [get]
//
//	@id				GetProcessStatus
func (h *Handler) GetProcessStatus(ctx *gin.Context) {
	processName := ctx.Param("processName")
	req := &api.ProcessRequest{
		ProcessName: processName,
	}
	isRunning, err := h.ComputerUse.IsProcessRunning(req)
	if err != nil {
		ctx.JSON(http.StatusServiceUnavailable, gin.H{
			"error":   "Failed to get process status",
			"details": err.Error(),
		})
		return
	}

	ctx.JSON(http.StatusOK, gin.H{
		"processName": processName,
		"running":     isRunning,
	})
}

// RestartProcess godoc
//
//	@Summary		Restart specific process
//	@Description	Restart a specific computer use process
//	@Tags			computer-use
//	@Produce		json
//	@Param			processName	path		string	true	"Process name to restart"
//	@Success		200			{object}	api.ProcessRestartResponse
//	@Router			/computeruse/process/{processName}/restart [post]
//
//	@id				RestartProcess
func (h *Handler) RestartProcess(ctx *gin.Context) {
	processName := ctx.Param("processName")
	req := &api.ProcessRequest{
		ProcessName: processName,
	}
	_, err := h.ComputerUse.RestartProcess(req)

	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{
			"error": err.Error(),
		})
		return
	}

	ctx.JSON(http.StatusOK, gin.H{
		"message":     fmt.Sprintf("Process %s restarted successfully", processName),
		"processName": processName,
	})
}

// GetProcessLogs godoc
//
//	@Summary		Get process logs
//	@Description	Get logs for a specific computer use process
//	@Tags			computer-use
//	@Produce		json
//	@Param			processName	path		string	true	"Process name to get logs for"
//	@Success		200			{object}	api.ProcessLogsResponse
//	@Router			/computeruse/process/{processName}/logs [get]
//
//	@id				GetProcessLogs
func (h *Handler) GetProcessLogs(ctx *gin.Context) {
	processName := ctx.Param("processName")
	req := &api.ProcessRequest{
		ProcessName: processName,
	}
	logs, err := h.ComputerUse.GetProcessLogs(req)

	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{
			"error": err.Error(),
		})
		return
	}

	ctx.JSON(http.StatusOK, gin.H{
		"processName": processName,
		"logs":        logs,
	})
}

// GetProcessErrors godoc
//
//	@Summary		Get process errors
//	@Description	Get errors for a specific computer use process
//	@Tags			computer-use
//	@Produce		json
//	@Param			processName	path		string	true	"Process name to get errors for"
//	@Success		200			{object}	api.ProcessErrorsResponse
//	@Router			/computeruse/process/{processName}/errors [get]
//
//	@id				GetProcessErrors
func (h *Handler) GetProcessErrors(ctx *gin.Context) {
	processName := ctx.Param("processName")
	req := &api.ProcessRequest{
		ProcessName: processName,
	}
	errors, err := h.ComputerUse.GetProcessErrors(req)

	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{
			"error": err.Error(),
		})
		return
	}

	ctx.JSON(http.StatusOK, gin.H{
		"processName": processName,
		"errors":      errors,
	})
}

// OpenBrowser godoc
//
//	@Summary		Open or navigate browser
//	@Description	Open the browser to a specific URL or navigate if already open
//	@Tags			computer-use
//	@Accept			json
//	@Produce		json
//	@Param			request	body		api.BrowserOpenRequest	true	"Browser open parameters"
//	@Success		200		{object}	api.Empty
//	@Router			/computeruse/browser/open [post]
//
//	@id				OpenBrowser
func (h *Handler) OpenBrowser(ctx *gin.Context) {
	var req api.BrowserOpenRequest
	if err := ctx.ShouldBindJSON(&req); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request body"})
		return
	}

	_, err := h.ComputerUse.OpenBrowser(&req)
	if err != nil {
		ctx.JSON(http.StatusServiceUnavailable, gin.H{
			"error":   "Failed to open browser",
			"details": err.Error(),
		})
		return
	}

	ctx.JSON(http.StatusOK, gin.H{"message": "Browser opened successfully"})
}

// CloseBrowser godoc
//
//	@Summary		Close browser
//	@Description	Force close the browser process and cleanup
//	@Tags			computer-use
//	@Produce		json
//	@Success		200	{object}	api.Empty
//	@Router			/computeruse/browser/close [post]
//
//	@id				CloseBrowser
func (h *Handler) CloseBrowser(ctx *gin.Context) {
	_, err := h.ComputerUse.CloseBrowser()
	if err != nil {
		ctx.JSON(http.StatusServiceUnavailable, gin.H{
			"error":   "Failed to close browser",
			"details": err.Error(),
		})
		return
	}

	ctx.JSON(http.StatusOK, gin.H{"message": "Browser closed successfully"})
}
