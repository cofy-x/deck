package log

import (
	"bytes"
	"strings"
	"testing"
)

func TestCallerInfo(t *testing.T) {
	// Enable caller and capture output
	var buf bytes.Buffer
	logger = logger.Output(&buf)
	enableCaller = true
	callerBasePath = "" // Use absolute paths for clarity

	// Test simple log function
	buf.Reset()
	Info("test simple log")
	output := buf.String()
	t.Logf("Simple log output: %s", output)

	if !strings.Contains(output, "caller_test.go") {
		t.Errorf("Caller should be caller_test.go, got: %s", output)
	}
	if strings.Contains(output, "logger.go") {
		t.Errorf("Caller should not be logger.go, got: %s", output)
	}

	// Test formatted log function
	buf.Reset()
	Infof("test formatted %s", "log")
	output = buf.String()
	t.Logf("Formatted log output: %s", output)

	if !strings.Contains(output, "caller_test.go") {
		t.Errorf("Caller should be caller_test.go, got: %s", output)
	}

	// Test WithField
	buf.Reset()
	WithField("key", "value").Info("test with field")
	output = buf.String()
	t.Logf("WithField output: %s", output)

	if !strings.Contains(output, "caller_test.go") {
		t.Errorf("Caller should be caller_test.go, got: %s", output)
	}
	if strings.Contains(output, "fields.go") {
		t.Errorf("Caller should not be fields.go, got: %s", output)
	}

	// Test WithFields
	buf.Reset()
	WithFields(Fields{"k1": "v1", "k2": "v2"}).Info("test with fields")
	output = buf.String()
	t.Logf("WithFields output: %s", output)

	if !strings.Contains(output, "caller_test.go") {
		t.Errorf("Caller should be caller_test.go, got: %s", output)
	}

	// Test WithError
	buf.Reset()
	WithError(nil).Info("test with error")
	output = buf.String()
	t.Logf("WithError output: %s", output)

	if !strings.Contains(output, "caller_test.go") {
		t.Errorf("Caller should be caller_test.go, got: %s", output)
	}

	// Test chained calls - caller should be captured at first WithField
	buf.Reset()
	WithField("a", "1").WithField("b", "2").Info("chained")
	output = buf.String()
	t.Logf("Chained output: %s", output)

	if !strings.Contains(output, "caller_test.go") {
		t.Errorf("Caller should be caller_test.go, got: %s", output)
	}
}

func TestCallerDisabled(t *testing.T) {
	var buf bytes.Buffer
	logger = logger.Output(&buf)
	enableCaller = false

	buf.Reset()
	Info("test without caller")
	output := buf.String()
	t.Logf("Caller disabled output: %s", output)

	// Should not contain caller field when disabled
	if strings.Contains(output, `"caller"`) {
		t.Errorf("Caller field should not be present when disabled, got: %s", output)
	}
}

func TestCallerWithBasePath(t *testing.T) {
	var buf bytes.Buffer
	logger = logger.Output(&buf)
	enableCaller = true
	callerBasePath = "/Users/wayne/deck" // Set base path

	buf.Reset()
	Info("test with base path")
	output := buf.String()
	t.Logf("With base path output: %s", output)

	// Should show relative path from base
	if strings.Contains(output, "/Users/wayne/deck/") {
		t.Errorf("Should show relative path, got absolute: %s", output)
	}
	if !strings.Contains(output, "packages/core-go/pkg/log/caller_test.go") {
		t.Errorf("Should contain relative path, got: %s", output)
	}
}

func TestNormalizeCallerPathRelative(t *testing.T) {
	callerBasePath = ""
	input := "../../Users/xxx/workspace/deck/packages/daemon/cmd/daemon/main.go"
	got := normalizeCallerPath(input)
	expected := "packages/daemon/cmd/daemon/main.go"

	if got != expected {
		t.Errorf("Expected %s, got: %s", expected, got)
	}
}
