package provider

import (
	"fmt"
	"os"
	"strings"
	"time"

	"github.com/cofy-x/deck/packages/computer-use/api"
	"github.com/cofy-x/deck/packages/core-go/pkg/log"
	"github.com/go-vgo/robotgo"
)

func (u *ComputerUse) GetMousePosition() (*api.MousePositionResponse, error) {
	// Debug: Check DISPLAY environment variable
	display := os.Getenv("DISPLAY")
	log.Infof("GetMousePosition: DISPLAY=%s", display)

	x, y := robotgo.Location()

	return &api.MousePositionResponse{
		Position: api.Position{
			X: x,
			Y: y,
		},
	}, nil
}

func (u *ComputerUse) MoveMouse(req *api.MouseMoveRequest) (*api.MousePositionResponse, error) {
	robotgo.Move(req.X, req.Y)

	// Small delay to ensure movement completes
	time.Sleep(50 * time.Millisecond)

	// Get the mouse position after move
	actualX, actualY := robotgo.Location()

	return &api.MousePositionResponse{
		Position: api.Position{
			X: actualX,
			Y: actualY,
		},
	}, nil
}

func (u *ComputerUse) Click(req *api.MouseClickRequest) (*api.MouseClickResponse, error) {
	// Default to left button
	if req.Button == "" {
		req.Button = "left"
	}

	// Move mouse to position first
	robotgo.Move(req.X, req.Y)
	time.Sleep(100 * time.Millisecond) // Wait for mouse to move

	// Perform the click
	if req.Double {
		robotgo.Click(req.Button, true)
	} else {
		robotgo.Click(req.Button, false)
	}

	// Get position after click
	actualX, actualY := robotgo.Location()

	return &api.MouseClickResponse{
		Position: api.Position{
			X: actualX,
			Y: actualY,
		},
	}, nil
}

// Helper function to move mouse smoothly in steps
func moveMouseSmoothly(startX, startY, endX, endY, steps int) {
	dx := float64(endX-startX) / float64(steps)
	dy := float64(endY-startY) / float64(steps)
	for i := 1; i <= steps; i++ {
		x := int(float64(startX) + dx*float64(i))
		y := int(float64(startY) + dy*float64(i))
		robotgo.Move(x, y)
		time.Sleep(2 * time.Millisecond)
	}
}

func (u *ComputerUse) Drag(req *api.MouseDragRequest) (*api.MouseDragResponse, error) {
	// Default to left button
	if req.Button == "" {
		req.Button = "left"
	}

	// Move to start position
	robotgo.Move(req.StartX, req.StartY)
	time.Sleep(100 * time.Millisecond)

	// Click to focus window before drag
	robotgo.Click(req.Button, false)
	time.Sleep(100 * time.Millisecond)

	// Ensure mouse button is up before starting
	err := robotgo.MouseUp(req.Button)
	if err != nil {
		return nil, err
	}
	time.Sleep(50 * time.Millisecond)

	// Press and hold mouse button
	err = robotgo.MouseDown(req.Button)
	if err != nil {
		return nil, err
	}
	time.Sleep(300 * time.Millisecond) // Increased delay

	// Move to end position while holding (smoothly)
	moveMouseSmoothly(req.StartX, req.StartY, req.EndX, req.EndY, 20)
	time.Sleep(100 * time.Millisecond)

	// Release mouse button
	err = robotgo.MouseUp(req.Button)
	if err != nil {
		return nil, err
	}
	time.Sleep(50 * time.Millisecond)

	// Get final position
	actualX, actualY := robotgo.Location()

	return &api.MouseDragResponse{
		Position: api.Position{
			X: actualX,
			Y: actualY,
		},
	}, nil
}

func (u *ComputerUse) Scroll(req *api.MouseScrollRequest) (*api.ScrollResponse, error) {
	scrollY, err := normalizeScrollDelta(req)
	if err != nil {
		return nil, err
	}

	// Move mouse to scroll position
	robotgo.Move(req.X, req.Y)
	time.Sleep(50 * time.Millisecond)

	// Use a single scroll event to avoid blocking behavior in ScrollSmooth with invalid loop counts.
	robotgo.Scroll(0, scrollY)

	return &api.ScrollResponse{
		Success: true,
	}, nil
}

func normalizeScrollDelta(req *api.MouseScrollRequest) (int, error) {
	if req == nil {
		return 0, fmt.Errorf("scroll request is required")
	}

	direction := strings.ToLower(strings.TrimSpace(req.Direction))
	if direction == "" {
		return 0, fmt.Errorf("scroll direction is required")
	}

	amount := req.Amount
	if amount == 0 {
		amount = 3
	}
	if amount < 0 {
		amount = -amount
	}

	switch direction {
	case "up":
		return amount, nil
	case "down":
		return -amount, nil
	default:
		return 0, fmt.Errorf("invalid scroll direction %q, expected 'up' or 'down'", req.Direction)
	}
}
