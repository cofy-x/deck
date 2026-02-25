package log

import (
	"fmt"
	"runtime"

	"github.com/rs/zerolog"
)

// Fields is a map of key-value pairs for structured logging.
// This type is compatible with logrus.Fields.
type Fields map[string]interface{}

// Entry represents a log entry with attached fields.
// It provides a logrus-compatible interface for structured logging.
type Entry struct {
	fields Fields
	err    error
	caller string // Captured caller info (only if enabled)
}

// entryCallerSkip is the number of stack frames to skip for Entry creation.
// Stack: runtime.Caller(0) -> getCallerForEntry(1) -> WithField(2=caller)
const entryCallerSkip = 2

// getCallerForEntry returns the file:line of the caller.
// Returns empty string if caller is disabled.
func getCallerForEntry(skip int) string {
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

// WithField creates a new Entry with a single field.
func WithField(key string, value interface{}) *Entry {
	return &Entry{
		fields: Fields{key: value},
		caller: getCallerForEntry(entryCallerSkip),
	}
}

// WithFields creates a new Entry with multiple fields.
func WithFields(fields Fields) *Entry {
	return &Entry{
		fields: fields,
		caller: getCallerForEntry(entryCallerSkip),
	}
}

// WithError creates a new Entry with an error field.
func WithError(err error) *Entry {
	return &Entry{
		err:    err,
		fields: make(Fields),
		caller: getCallerForEntry(entryCallerSkip),
	}
}

// WithField adds a field to the entry and returns it for chaining.
func (e *Entry) WithField(key string, value interface{}) *Entry {
	if e.fields == nil {
		e.fields = make(Fields)
	}
	e.fields[key] = value
	return e
}

// WithFields adds multiple fields to the entry and returns it for chaining.
func (e *Entry) WithFields(fields Fields) *Entry {
	if e.fields == nil {
		e.fields = make(Fields)
	}
	for k, v := range fields {
		e.fields[k] = v
	}
	return e
}

// WithError adds an error to the entry and returns it for chaining.
func (e *Entry) WithError(err error) *Entry {
	e.err = err
	return e
}

// addCallerToEvent adds caller info to event if available.
func (e *Entry) addCallerToEvent(event *zerolog.Event) *zerolog.Event {
	if e.caller != "" {
		return event.Str("caller", e.caller)
	}
	return event
}

// Trace logs a message at trace level with the entry's fields.
func (e *Entry) Trace(msg string) {
	event := e.addCallerToEvent(logger.Trace())
	if e.err != nil {
		event = event.Err(e.err)
	}
	for k, v := range e.fields {
		event = event.Interface(k, v)
	}
	event.Msg(msg)
}

// Tracef logs a formatted message at trace level with the entry's fields.
func (e *Entry) Tracef(format string, v ...interface{}) {
	event := e.addCallerToEvent(logger.Trace())
	if e.err != nil {
		event = event.Err(e.err)
	}
	for k, val := range e.fields {
		event = event.Interface(k, val)
	}
	event.Msgf(format, v...)
}

// Debug logs a message at debug level with the entry's fields.
func (e *Entry) Debug(msg string) {
	event := e.addCallerToEvent(logger.Debug())
	if e.err != nil {
		event = event.Err(e.err)
	}
	for k, v := range e.fields {
		event = event.Interface(k, v)
	}
	event.Msg(msg)
}

// Debugf logs a formatted message at debug level with the entry's fields.
func (e *Entry) Debugf(format string, v ...interface{}) {
	event := e.addCallerToEvent(logger.Debug())
	if e.err != nil {
		event = event.Err(e.err)
	}
	for k, val := range e.fields {
		event = event.Interface(k, val)
	}
	event.Msgf(format, v...)
}

// Info logs a message at info level with the entry's fields.
func (e *Entry) Info(msg string) {
	event := e.addCallerToEvent(logger.Info())
	if e.err != nil {
		event = event.Err(e.err)
	}
	for k, v := range e.fields {
		event = event.Interface(k, v)
	}
	event.Msg(msg)
}

// Infof logs a formatted message at info level with the entry's fields.
func (e *Entry) Infof(format string, v ...interface{}) {
	event := e.addCallerToEvent(logger.Info())
	if e.err != nil {
		event = event.Err(e.err)
	}
	for k, val := range e.fields {
		event = event.Interface(k, val)
	}
	event.Msgf(format, v...)
}

// Warn logs a message at warn level with the entry's fields.
func (e *Entry) Warn(msg string) {
	event := e.addCallerToEvent(logger.Warn())
	if e.err != nil {
		event = event.Err(e.err)
	}
	for k, v := range e.fields {
		event = event.Interface(k, v)
	}
	event.Msg(msg)
}

// Warnf logs a formatted message at warn level with the entry's fields.
func (e *Entry) Warnf(format string, v ...interface{}) {
	event := e.addCallerToEvent(logger.Warn())
	if e.err != nil {
		event = event.Err(e.err)
	}
	for k, val := range e.fields {
		event = event.Interface(k, val)
	}
	event.Msgf(format, v...)
}

// Error logs a message at error level with the entry's fields.
func (e *Entry) Error(msg string) {
	event := e.addCallerToEvent(logger.Error())
	if e.err != nil {
		event = event.Err(e.err)
	}
	for k, v := range e.fields {
		event = event.Interface(k, v)
	}
	event.Msg(msg)
}

// Errorf logs a formatted message at error level with the entry's fields.
func (e *Entry) Errorf(format string, v ...interface{}) {
	event := e.addCallerToEvent(logger.Error())
	if e.err != nil {
		event = event.Err(e.err)
	}
	for k, val := range e.fields {
		event = event.Interface(k, val)
	}
	event.Msgf(format, v...)
}

// Fatal logs a message at fatal level with the entry's fields and exits.
func (e *Entry) Fatal(msg string) {
	event := e.addCallerToEvent(logger.Fatal())
	if e.err != nil {
		event = event.Err(e.err)
	}
	for k, v := range e.fields {
		event = event.Interface(k, v)
	}
	event.Msg(msg)
}

// Fatalf logs a formatted message at fatal level with the entry's fields and exits.
func (e *Entry) Fatalf(format string, v ...interface{}) {
	event := e.addCallerToEvent(logger.Fatal())
	if e.err != nil {
		event = event.Err(e.err)
	}
	for k, val := range e.fields {
		event = event.Interface(k, val)
	}
	event.Msgf(format, v...)
}

// Panic logs a message at panic level with the entry's fields and panics.
func (e *Entry) Panic(msg string) {
	event := e.addCallerToEvent(logger.Panic())
	if e.err != nil {
		event = event.Err(e.err)
	}
	for k, v := range e.fields {
		event = event.Interface(k, v)
	}
	event.Msg(msg)
}

// Panicf logs a formatted message at panic level with the entry's fields and panics.
func (e *Entry) Panicf(format string, v ...interface{}) {
	event := e.addCallerToEvent(logger.Panic())
	if e.err != nil {
		event = event.Err(e.err)
	}
	for k, val := range e.fields {
		event = event.Interface(k, val)
	}
	event.Msgf(format, v...)
}
