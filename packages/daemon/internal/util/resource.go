package util

import (
	"os"

	"github.com/cofy-x/deck/packages/core-go/pkg/log"
)

// GetFDCount returns the number of open file descriptors for the current process.
func GetFDCount() int {
	files, err := os.ReadDir("/proc/self/fd")
	if err != nil {
		log.Warnf("failed to count FDs: %v", err)
		return -1
	}
	return len(files)
}
