//go:build darwin

package port

import (
	"context"
	"errors"
	"fmt"
	"net"
	"net/http"
	"os/exec"
	"strconv"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	cmap "github.com/orcaman/concurrent-map/v2"
)

type portsDetector struct {
	portMap cmap.ConcurrentMap[string, bool]
}

func NewPortsDetector() *portsDetector {
	return &portsDetector{
		portMap: cmap.New[bool](),
	}
}

// Darwin implementation using netstat command instead of go-netstat library
func (d *portsDetector) Start(ctx context.Context) {
	for {
		select {
		case <-ctx.Done():
			return
		default:
			time.Sleep(1 * time.Second)

			// Use netstat command to get listening TCP ports on macOS
			listeningPorts := d.getListeningPorts()

			freshMap := map[string]bool{}
			for _, port := range listeningPorts {
				portStr := strconv.Itoa(port)
				freshMap[portStr] = true
				d.portMap.Set(portStr, true)
			}

			// Remove ports that are no longer in use
			for _, port := range d.portMap.Keys() {
				if !freshMap[port] {
					d.portMap.Remove(port)
				}
			}
		}
	}
}

// getListeningPorts uses netstat command to get all listening TCP ports
func (d *portsDetector) getListeningPorts() []int {
	var ports []int

	// Execute netstat command to get listening TCP ports
	cmd := exec.Command("netstat", "-an", "-p", "tcp")
	output, err := cmd.Output()
	if err != nil {
		return ports
	}

	lines := strings.Split(string(output), "\n")
	for _, line := range lines {
		if strings.Contains(line, "LISTEN") {
			fields := strings.Fields(line)
			if len(fields) >= 4 {
				// Extract port from address like "*.8080" or "127.0.0.1.8080"
				address := fields[3]
				if idx := strings.LastIndex(address, "."); idx != -1 {
					portStr := address[idx+1:]
					if port, err := strconv.Atoi(portStr); err == nil {
						ports = append(ports, port)
					}
				}
			}
		}
	}

	return ports
}

func (d *portsDetector) GetPorts(c *gin.Context) {
	ports := PortList{
		Ports: []uint{},
	}

	for _, port := range d.portMap.Keys() {
		portInt, err := strconv.Atoi(port)
		if err != nil {
			continue
		}
		ports.Ports = append(ports.Ports, uint(portInt))
	}

	c.JSON(http.StatusOK, ports)
}

func (d *portsDetector) IsPortInUse(c *gin.Context) {
	portParam := c.Param("port")

	port, err := strconv.Atoi(portParam)
	if err != nil {
		c.AbortWithError(http.StatusBadRequest, errors.New("invalid port: must be a number between 3000 and 9999"))
		return
	}

	if port < 3000 || port > 9999 {
		c.AbortWithError(http.StatusBadRequest, errors.New("port out of range: must be between 3000 and 9999"))
		return
	}

	portStr := strconv.Itoa(port)

	if d.portMap.Has(portStr) {
		c.JSON(http.StatusOK, IsPortInUseResponse{
			IsInUse: true,
		})
	} else {
		// If the port is not in the map, we check synchronously if it's in use and update the map
		_, err := net.DialTimeout("tcp", fmt.Sprintf("localhost:%d", port), 50*time.Millisecond)
		if err != nil {
			c.JSON(http.StatusOK, IsPortInUseResponse{
				IsInUse: false,
			})
		} else {
			d.portMap.Set(portStr, true)
			c.JSON(http.StatusOK, IsPortInUseResponse{
				IsInUse: true,
			})
		}
	}
}
