package output

import (
	"encoding/json"
	"fmt"
	"os"

	"github.com/cofy-x/deck/apps/cli/internal/config"
	"github.com/fatih/color"
)

// OutputFormat represents the output format type.
type OutputFormat string

const (
	// FormatJSON outputs as JSON.
	FormatJSON OutputFormat = "json"
	// FormatText outputs as plain text.
	FormatText OutputFormat = "text"
)

var (
	// Green color for success messages.
	Green = color.New(color.FgGreen).SprintFunc()
	// Red color for error messages.
	Red = color.New(color.FgRed).SprintFunc()
	// Yellow color for warning messages.
	Yellow = color.New(color.FgYellow).SprintFunc()
	// Cyan color for info messages.
	Cyan = color.New(color.FgCyan).SprintFunc()
	// Bold text.
	Bold = color.New(color.Bold).SprintFunc()
)

// InitColors initializes color settings based on configuration.
func InitColors() {
	if config.GlobalConfig != nil && config.GlobalConfig.NoColor {
		color.NoColor = true
	}
}

// Print outputs the value using the configured output format.
func Print(v interface{}) error {
	format := config.GlobalConfig.OutputFormat

	switch format {
	case "json":
		return PrintJSON(v)
	case "text":
		return PrintText(v)
	default:
		return PrintJSON(v)
	}
}

// PrintJSON outputs the value as formatted JSON.
func PrintJSON(v interface{}) error {
	b, err := json.MarshalIndent(v, "", "  ")
	if err != nil {
		return err
	}
	fmt.Println(string(b))
	return nil
}

// PrintText outputs the value as plain text.
func PrintText(v interface{}) error {
	fmt.Printf("%+v\n", v)
	return nil
}

// PrintSuccess prints a success message with a green checkmark.
func PrintSuccess(message string) {
	fmt.Println(Green("✓"), message)
}

// PrintError prints an error message with a red cross.
func PrintError(err error) {
	fmt.Fprintf(os.Stderr, "%s Error: %v\n", Red("✗"), err)
}

// PrintWarning prints a warning message with a yellow warning sign.
func PrintWarning(message string) {
	fmt.Println(Yellow("⚠"), message)
}

// PrintInfo prints an info message with a cyan info sign.
func PrintInfo(message string) {
	fmt.Println(Cyan("ℹ"), message)
}
