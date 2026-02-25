# Bug Fix: Process Execute Race Condition

## Problem Description

The `/process/execute` endpoint exhibited inconsistent behavior across different environments:

- **Mac (local)**: Always returned `exitCode: 0`, even for failed commands
- **Container (Linux)**: Occasionally returned `exitCode: -1` despite successful command execution

### Symptoms

When `exitCode: -1` occurred in containerized environments, the logs showed:

```
Successfully reaped zombie process [PID: 85], Status: 0
API REQUEST URI=/process/execute latency=23364896 method=POST status=200
```

This indicated:

- The command actually succeeded (Status: 0)
- The result output was correct
- But the exit code was incorrectly reported as -1

## Root Cause Analysis

### The Race Condition

The daemon implements a **Zombie Reaper** as PID 1 (see `main.go:30-55`):

```go
func StartZombieReaper() {
    sigCh := make(chan os.Signal, 64)
    signal.Notify(sigCh, syscall.SIGCHLD)

    go func() {
        for range sigCh {
            for {
                var wstatus syscall.WaitStatus
                pid, err := syscall.Wait4(-1, &wstatus, syscall.WNOHANG, nil)
                // ... reaps ALL child processes
            }
        }
    }()
}
```

The race condition sequence:

1. `exec.Command` starts a child process via `execute.go:41`
2. Child process completes execution
3. OS sends `SIGCHLD` to daemon (PID 1)
4. **Zombie Reaper goroutine** receives SIGCHLD and calls `Wait4(-1, ...)`
5. Reaper harvests the process **before** `cmd.CombinedOutput()` calls its internal `Wait()`
6. When `CombinedOutput()` eventually calls `Wait()`, it gets `syscall.ECHILD` (no child process)
7. This error is **not** `*exec.ExitError`, so the code falls through to:

```go
c.JSON(http.StatusOK, ExecuteResponse{
    ExitCode: -1,  // ❌ Wrong!
    Result:   string(output),
})
```

### Why Different Behavior?

- **Linux containers**: Aggressive process scheduling and immediate SIGCHLD delivery made the race condition frequent
- **macOS**: Different timing characteristics and possibly different Go runtime behavior made the race rare/impossible

## Solution

### Process Registry + Exit Status Cache

The fix uses a **cooperative approach** between the zombie reaper and `exec.Command`:

**Key Components:**

1. **ProcessRegistry** (`registry.go`): Tracks PIDs being actively waited on and caches exit statuses
2. **Modified execute.go**: Registers PIDs before waiting, retrieves cached exit status if reaped
3. **Modified zombie reaper**: Caches exit status when reaping registered PIDs

**How it works:**

```go
// 1. Register PID before waiting
registry.Register(pid)
defer registry.Unregister(pid)

// 2. Wait for process
err := cmd.Wait()

// 3. If already reaped, get exit status from cache
if err.Error() == "waitid: no child processes" {
    if cachedStatus, found := registry.GetCachedExitStatus(pid); found {
        exitCode = cachedStatus.ExitStatus()
    }
}
```

**Zombie Reaper Logic:**

```go
// When reaping a process
pid, err := syscall.Wait4(-1, &wstatus, syscall.WNOHANG, nil)

// Check if it's a registered process
if registry.IsRegistered(pid) {
    // Cache the exit status for cmd.Wait() to retrieve later
    registry.CacheExitStatus(pid, wstatus)
}
```

**Why this works:**

1. `Wait4(-1, ...)` will always reap **any** exited child (regardless of process group)
2. We can't prevent the reaper from winning the race
3. Instead, we **save the exit status** when the reaper wins
4. `cmd.Wait()` retrieves the cached status instead of returning `-1`
5. Both reaper and `cmd.Wait()` can coexist without conflicts

### Process Group for Timeout Handling

We still use process groups for clean timeout termination:

```go
cmd.SysProcAttr = &syscall.SysProcAttr{
    Setpgid: true,  // Create process group for child processes
}

// Kill entire process group on timeout
syscall.Kill(-pgid, syscall.SIGKILL)
```

This ensures child processes spawned by the command are also terminated.

## Verification

### Test Script

Run the test script from the project root:

```bash
./tests/integration/test_daemon_process_execute.sh
```

Expected results:

- ✅ Test 1: exitCode = 0 (successful command)
- ✅ Test 2: exitCode = 2 (intentional failure)
- ✅ Test 3: All 10 concurrent commands return exitCode = 0

If any test shows `exitCode: -1`, the bug still exists.

### Manual Testing

```bash
# Should return exitCode: 0
curl --request POST \
  --url http://localhost:2280/process/execute \
  --header 'content-type: application/json' \
  --data '{
  "command": "ls -al",
  "cwd": "/"
}'

# Should return exitCode: 2 (ls error)
curl --request POST \
  --url http://localhost:2280/process/execute \
  --header 'content-type: application/json' \
  --data '{
  "command": "ls /nonexistent"
}'

# Should return exitCode: 127 (command not found)
curl --request POST \
  --url http://localhost:2280/process/execute \
  --header 'content-type: application/json' \
  --data '{
  "command": "nonexistent-command"
}'
```

## Technical Details

### Why Registry + Cache Approach

Initial attempts with `Setpgid` to isolate process groups failed because:

- `Wait4(-1, ...)` waits for **any child process**, regardless of process group
- Process groups only affect signal delivery, not wait behavior
- We cannot prevent the reaper from winning the race

The registry + cache approach works because:

1. **Cooperative Design**: Both reaper and `cmd.Wait()` can succeed
2. **No Race Condition**: Exit status is preserved even if reaper wins
3. **Simple Implementation**: No complex process group management
4. **Debuggable**: Comprehensive logging shows exactly what happened

### Key Insights

- **`Wait4(-1, ...)`**: Waits for any direct child of the calling process
- **SIGCHLD Handling**: Both Go runtime and our reaper receive the signal
- **Exit Status**: Once reaped, it's gone - must cache it for later retrieval
- **Thread Safety**: Registry uses `sync.RWMutex` for concurrent access

### Cross-Platform Compatibility

This fix works on:

- ✅ **Linux** (all distributions)
- ✅ **macOS** (Darwin)
- ✅ **BSD variants**

The `Setpgid` flag is part of POSIX and universally supported.

## Configuration

You can tune the wait time used when `cmd.Wait()` returns `ECHILD` and the exit
status has not been cached yet. This avoids false `-1` exit codes under high
concurrency.

Environment variable:

- `DECK_EXECUTE_ECHILD_WAIT_MS`: Milliseconds to wait for the exit status cache
  after an `ECHILD` error. Default is `200` ms. Set to `0` to disable waiting.

## Files Modified

1. **`pkg/toolbox/process/registry.go`** (new file):
   - `ProcessRegistry`: Tracks registered PIDs and caches exit statuses
   - Thread-safe with `sync.RWMutex`
   - Global registry instance accessible via `GetRegistry()`

2. **`pkg/toolbox/process/execute.go`**:
   - Register PID after `cmd.Start()`
   - Use registry to get cached exit status if process was reaped
   - Added comprehensive logging for debugging
   - Changed from `CombinedOutput()` to manual `Start()`+`Wait()` for better control

3. **`cmd/daemon/main.go`**:
   - Import process registry
   - Modified zombie reaper to cache exit status for registered PIDs
   - Enhanced logging to distinguish managed vs unmanaged processes

## Related Issues

This fix also prevents potential issues with:

- Commands that spawn long-running background processes
- Shell pipelines (e.g., `ls | grep foo`)
- Scripts that fork child processes

All child processes are now properly isolated and cleaned up.

## Further Reading

- POSIX Process Groups: https://pubs.opengroup.org/onlinepubs/9699919799/basedefs/V1_chap03.html#tag_03_225
- Go exec.Cmd documentation: https://pkg.go.dev/os/exec#Cmd
- Linux wait() syscall: https://man7.org/linux/man-pages/man2/wait.2.html
