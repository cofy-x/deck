package process

import (
	"sync"
	"syscall"
	"time"
)

// ExitStatus holds the exit information for a reaped process.
type ExitStatus struct {
	Status   syscall.WaitStatus
	CachedAt time.Time
}

// ProcessRegistry tracks PIDs that are being actively waited on by exec.Command
// and caches exit statuses for processes that were reaped by the zombie reaper.
type ProcessRegistry struct {
	mu        sync.RWMutex
	processes map[int]struct{}
	exitCache map[int]ExitStatus
	waiters   map[int]chan ExitStatus
}

var registry = &ProcessRegistry{
	processes: make(map[int]struct{}),
	exitCache: make(map[int]ExitStatus),
	waiters:   make(map[int]chan ExitStatus),
}

const exitCacheTTL = 30 * time.Second

// Register marks a PID as being actively waited on.
func (r *ProcessRegistry) Register(pid int) {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.processes[pid] = struct{}{}
	if _, exists := r.waiters[pid]; !exists {
		r.waiters[pid] = make(chan ExitStatus, 1)
	}
}

// Unregister removes a PID from the active wait list and clears its exit cache.
func (r *ProcessRegistry) Unregister(pid int) {
	r.mu.Lock()
	defer r.mu.Unlock()
	delete(r.processes, pid)
	delete(r.waiters, pid)
}

// IsRegistered checks if a PID is being actively waited on.
func (r *ProcessRegistry) IsRegistered(pid int) bool {
	r.mu.RLock()
	defer r.mu.RUnlock()
	_, exists := r.processes[pid]
	return exists
}

// CacheExitStatus stores the exit status of a reaped process.
func (r *ProcessRegistry) CacheExitStatus(pid int, status syscall.WaitStatus) {
	r.mu.Lock()
	now := time.Now()
	r.pruneExitCacheLocked(now)
	r.exitCache[pid] = ExitStatus{Status: status, CachedAt: now}
	waiter := r.waiters[pid]
	r.mu.Unlock()
	if waiter != nil {
		select {
		case waiter <- ExitStatus{Status: status, CachedAt: now}:
		default:
		}
	}
}

// GetCachedExitStatus retrieves the cached exit status for a PID, if available.
func (r *ProcessRegistry) GetCachedExitStatus(pid int) (syscall.WaitStatus, bool) {
	r.mu.Lock()
	defer r.mu.Unlock()

	r.pruneExitCacheLocked(time.Now())
	if status, exists := r.exitCache[pid]; exists {
		return status.Status, true
	}
	return 0, false
}

// WaitForExitStatus waits briefly for a cached exit status to appear.
func (r *ProcessRegistry) WaitForExitStatus(pid int, timeout time.Duration) (syscall.WaitStatus, bool) {
	if timeout <= 0 {
		return r.GetCachedExitStatus(pid)
	}

	if status, ok := r.GetCachedExitStatus(pid); ok {
		return status, true
	}

	r.mu.RLock()
	waiter := r.waiters[pid]
	r.mu.RUnlock()
	if waiter == nil {
		return 0, false
	}

	timer := time.NewTimer(timeout)
	defer timer.Stop()

	select {
	case status := <-waiter:
		return status.Status, true
	case <-timer.C:
		return 0, false
	}
}

func (r *ProcessRegistry) pruneExitCacheLocked(now time.Time) {
	for pid, status := range r.exitCache {
		if now.Sub(status.CachedAt) > exitCacheTTL {
			delete(r.exitCache, pid)
		}
	}
}

// GetRegistry returns the global process registry.
func GetRegistry() *ProcessRegistry {
	return registry
}
