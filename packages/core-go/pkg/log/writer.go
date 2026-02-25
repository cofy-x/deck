package log

import (
	"strings"
)

// DebugLogWriter implements io.Writer and forwards output to Debug level.
// Use this to redirect output from libraries that write to io.Writer.
type DebugLogWriter struct{}

func (w *DebugLogWriter) Write(p []byte) (n int, err error) {
	Debug(strings.TrimSpace(string(p)))
	return len(p), nil
}

// InfoLogWriter implements io.Writer and forwards output to Info level.
type InfoLogWriter struct{}

func (w *InfoLogWriter) Write(p []byte) (n int, err error) {
	Info(strings.TrimSpace(string(p)))
	return len(p), nil
}

// WarnLogWriter implements io.Writer and forwards output to Warn level.
type WarnLogWriter struct{}

func (w *WarnLogWriter) Write(p []byte) (n int, err error) {
	Warn(strings.TrimSpace(string(p)))
	return len(p), nil
}

// ErrorLogWriter implements io.Writer and forwards output to Error level.
type ErrorLogWriter struct{}

func (w *ErrorLogWriter) Write(p []byte) (n int, err error) {
	Error(strings.TrimSpace(string(p)))
	return len(p), nil
}

// TraceLogWriter implements io.Writer and forwards output to Trace level.
type TraceLogWriter struct{}

func (w *TraceLogWriter) Write(p []byte) (n int, err error) {
	Trace(strings.TrimSpace(string(p)))
	return len(p), nil
}
