// Package log provides a unified logging interface built on zerolog.
// It offers a logrus-compatible API to minimize migration effort while
// leveraging zerolog's zero-allocation performance.
package log

import (
	"fmt"
	"io"
	"os"
	"runtime"
	"strings"
	"time"

	"github.com/rs/zerolog"
)

// logger is the global zerolog logger instance.
var logger zerolog.Logger

// Configuration options
var (
	// enableCaller controls whether to include caller information in logs.
	// Disabled by default for performance. Enable in development mode.
	enableCaller bool

	// callerBasePath is used to compute relative paths for caller info.
	// If empty, absolute paths are used.
	callerBasePath string
)

// Level represents the logging level.
type Level = zerolog.Level

// Logging levels compatible with logrus naming.
const (
	PanicLevel = zerolog.PanicLevel
	FatalLevel = zerolog.FatalLevel
	ErrorLevel = zerolog.ErrorLevel
	WarnLevel  = zerolog.WarnLevel
	InfoLevel  = zerolog.InfoLevel
	DebugLevel = zerolog.DebugLevel
	TraceLevel = zerolog.TraceLevel
)

func init() {
	// Initialize with a default logger to prevent nil pointer issues
	// before Init() is called.
	logger = zerolog.New(os.Stdout).With().Timestamp().Logger()
}

// Init initializes the global logger with the specified configuration.
// level: logging level (debug, info, warn, error, fatal, panic)
// pretty: if true, uses human-readable console output and enables caller info
func Init(level string, pretty bool) {
	lvl, err := zerolog.ParseLevel(level)
	if err != nil {
		lvl = zerolog.InfoLevel
	}
	zerolog.SetGlobalLevel(lvl)

	var output io.Writer = os.Stdout

	if pretty {
		output = zerolog.ConsoleWriter{
			Out:        os.Stdout,
			TimeFormat: time.RFC3339,
		}
		// Enable caller in pretty/development mode by default
		enableCaller = true
		// Try to detect project root for relative paths
		if cwd, err := os.Getwd(); err == nil {
			callerBasePath = cwd
		}
	}

	logger = zerolog.New(output).With().Timestamp().Logger()
}

// InitWithWriter initializes the global logger with a custom writer.
// Useful for writing logs to files or multiple destinations.
func InitWithWriter(level string, writer io.Writer, pretty bool) {
	lvl, err := zerolog.ParseLevel(level)
	if err != nil {
		lvl = zerolog.InfoLevel
	}
	zerolog.SetGlobalLevel(lvl)

	var output io.Writer = writer

	if pretty {
		output = zerolog.ConsoleWriter{
			Out:        writer,
			TimeFormat: time.RFC3339,
		}
		// Enable caller in pretty/development mode by default
		enableCaller = true
		// Try to detect project root for relative paths
		if cwd, err := os.Getwd(); err == nil {
			callerBasePath = cwd
		}
	}

	logger = zerolog.New(output).With().Timestamp().Logger()
}

// SetCallerEnabled enables or disables caller information in logs.
// Enabling caller info has performance overhead, use in development only.
func SetCallerEnabled(enabled bool) {
	enableCaller = enabled
}

// SetCallerBasePath sets the base path for computing relative caller paths.
// If set, caller paths will be shown relative to this base.
// If empty, absolute paths are used.
func SetCallerBasePath(basePath string) {
	callerBasePath = basePath
}

// getCaller returns the file:line of the caller, skipping the specified number of frames.
// Returns empty string if caller is disabled.
func getCaller(skip int) string {
	if !enableCaller {
		return ""
	}
	_, file, line, ok := runtime.Caller(skip)
	if !ok {
		return ""
	}
	file = normalizeCallerPath(file)

	return fmt.Sprintf("%s:%d", file, line)
}

// addCaller adds caller info to the event if enabled.
func addCaller(event *zerolog.Event, skip int) *zerolog.Event {
	if caller := getCaller(skip); caller != "" {
		return event.Str("caller", caller)
	}
	return event
}

// SetLevel sets the global logging level.
func SetLevel(level Level) {
	zerolog.SetGlobalLevel(level)
}

// GetLevel returns the current global logging level.
func GetLevel() Level {
	return zerolog.GlobalLevel()
}

// IsLevelEnabled checks if the given level is enabled.
func IsLevelEnabled(level Level) bool {
	return zerolog.GlobalLevel() <= level
}

// ParseLevel parses a level string into a Level value.
func ParseLevel(level string) (Level, error) {
	return zerolog.ParseLevel(level)
}

// SetOutput sets the output destination for the logger.
func SetOutput(w io.Writer) {
	logger = logger.Output(w)
}

// Logger returns the underlying zerolog.Logger for advanced usage.
func Logger() zerolog.Logger {
	return logger
}

// =============================================================================
// Logrus-compatible API - Simple logging functions
// =============================================================================

// callerSkip is the number of stack frames to skip for simple log functions.
// Stack: runtime.Caller(0) -> getCaller(1) -> addCaller(2) -> log.Info(3=caller)
const callerSkip = 3

// Trace logs a message at trace level.
func Trace(msg string) {
	addCaller(logger.Trace(), callerSkip).Msg(msg)
}

// Tracef logs a formatted message at trace level.
func Tracef(format string, v ...interface{}) {
	addCaller(logger.Trace(), callerSkip).Msgf(format, v...)
}

// Debug logs a message at debug level.
func Debug(msg string) {
	addCaller(logger.Debug(), callerSkip).Msg(msg)
}

// Debugf logs a formatted message at debug level.
func Debugf(format string, v ...interface{}) {
	addCaller(logger.Debug(), callerSkip).Msgf(format, v...)
}

// Info logs a message at info level.
func Info(msg string) {
	addCaller(logger.Info(), callerSkip).Msg(msg)
}

// Infof logs a formatted message at info level.
func Infof(format string, v ...interface{}) {
	addCaller(logger.Info(), callerSkip).Msgf(format, v...)
}

// Warn logs a message at warn level.
func Warn(msg string) {
	addCaller(logger.Warn(), callerSkip).Msg(msg)
}

// Warnf logs a formatted message at warn level.
func Warnf(format string, v ...interface{}) {
	addCaller(logger.Warn(), callerSkip).Msgf(format, v...)
}

// Error logs a message at error level.
func Error(msg string) {
	addCaller(logger.Error(), callerSkip).Msg(msg)
}

// Errorf logs a formatted message at error level.
func Errorf(format string, v ...interface{}) {
	addCaller(logger.Error(), callerSkip).Msgf(format, v...)
}

// Fatal logs a message at fatal level and exits.
func Fatal(msg string) {
	addCaller(logger.Fatal(), callerSkip).Msg(msg)
}

// Fatalf logs a formatted message at fatal level and exits.
func Fatalf(format string, v ...interface{}) {
	addCaller(logger.Fatal(), callerSkip).Msgf(format, v...)
}

// Panic logs a message at panic level and panics.
func Panic(msg string) {
	addCaller(logger.Panic(), callerSkip).Msg(msg)
}

// Panicf logs a formatted message at panic level and panics.
func Panicf(format string, v ...interface{}) {
	addCaller(logger.Panic(), callerSkip).Msgf(format, v...)
}

// Print logs a message at info level (logrus compatibility).
func Print(v ...interface{}) {
	addCaller(logger.Info(), callerSkip).Msg(fmt.Sprint(v...))
}

// Printf logs a formatted message at info level (logrus compatibility).
func Printf(format string, v ...interface{}) {
	addCaller(logger.Info(), callerSkip).Msgf(format, v...)
}

// Println logs a message at info level (logrus compatibility).
func Println(v ...interface{}) {
	msg := strings.TrimSuffix(fmt.Sprintln(v...), "\n")
	addCaller(logger.Info(), callerSkip).Msg(msg)
}
