package log

import "testing"

func TestLogging(t *testing.T) {
	Init("debug", true)
	Println("Testing Println with multiple args:", "/etc/config", 123)
	Print("Testing Print without trailing newline")
}
